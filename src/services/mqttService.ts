import mqtt, { MqttClient } from 'mqtt';

export interface MqttConfig {
  enabled: boolean;
  brokerUrl: string;
  topic: string;
  clientId: string;
}

export interface SaleNotificationPayload {
  event: 'NEW_SALE';
  invoice_number: string;
  sale_date: string;
  total_amount: number;
  payment_method: string;
  items_count: number;
  plate_number?: string;
  customer_name?: string;
  mechanic_name?: string;
  items_summary?: string;
  device_id: string;
}

const DEFAULT_CONFIG: MqttConfig = {
  enabled: true,
  brokerUrl: 'wss://broker.emqx.io:8084/mqtt',
  topic: 'larizk/motopos/sales/live',
  clientId: 'motopos_' + Math.random().toString(16).substring(2, 8),
};

const STORAGE_KEY = 'motopos_mqtt_config';

class MqttService {
  private client: MqttClient | null = null;
  private config: MqttConfig;
  private status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private listeners: ((status: 'disconnected' | 'connecting' | 'connected' | 'error') => void)[] = [];
  private messageListeners: ((topic: string, message: any) => void)[] = [];

  constructor() {
    this.config = this.loadConfig();
    if (this.config.enabled) {
      this.connect();
    }
  }

  public getConfig(): MqttConfig {
    return { ...this.config };
  }

  public saveConfig(newConfig: Partial<MqttConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save MQTT config to localStorage', e);
    }

    // Reconnect or disconnect based on new configuration
    if (this.config.enabled) {
      this.reconnect();
    } else {
      this.disconnect();
    }
  }

  private loadConfig(): MqttConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse MQTT config from localStorage', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  public getStatus() {
    return this.status;
  }

  public onStatusChange(callback: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void) {
    this.listeners.push(callback);
    callback(this.status);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public onMessage(callback: (topic: string, message: any) => void) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  private setStatus(newStatus: 'disconnected' | 'connecting' | 'connected' | 'error') {
    this.status = newStatus;
    this.listeners.forEach((cb) => cb(newStatus));
  }

  public connect() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {}
      this.client = null;
    }

    if (!this.config.enabled) {
      this.setStatus('disconnected');
      return;
    }

    try {
      this.setStatus('connecting');
      const client = mqtt.connect(this.config.brokerUrl, {
        clientId: this.config.clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 10000,
      });

      this.client = client;

      client.on('connect', () => {
        this.setStatus('connected');
        // Auto subscribe to own topic to monitor broadcasts
        client.subscribe(this.config.topic, { qos: 0 });
      });

      client.on('error', (err) => {
        console.warn('[MQTT Error]', err);
        this.setStatus('error');
      });

      client.on('offline', () => {
        this.setStatus('disconnected');
      });

      client.on('close', () => {
        if (this.status === 'connected') {
          this.setStatus('disconnected');
        }
      });

      client.on('message', (topic, payload) => {
        try {
          const parsed = JSON.parse(payload.toString());
          this.messageListeners.forEach((cb) => cb(topic, parsed));
        } catch {
          this.messageListeners.forEach((cb) => cb(topic, payload.toString()));
        }
      });
    } catch (err) {
      console.error('[MQTT Connection Exception]', err);
      this.setStatus('error');
    }
  }

  public disconnect() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {}
      this.client = null;
    }
    this.setStatus('disconnected');
  }

  public reconnect() {
    this.disconnect();
    this.connect();
  }

  /**
   * Publish a completed sale event non-blockingly
   */
  public async publishSale(saleData: {
    invoice_number: string;
    total_amount: number;
    payment_method: string;
    plate_number?: string;
    customer_name?: string;
    mechanic_name?: string;
    items?: { item_name: string; quantity: number }[];
  }): Promise<boolean> {
    if (!this.config.enabled || !this.client || this.status !== 'connected') {
      return false;
    }

    const itemsSummary = saleData.items
      ?.map((i) => `${i.quantity}x ${i.item_name}`)
      .join(', ') || 'Transaksi Penjualan';

    const payload: SaleNotificationPayload = {
      event: 'NEW_SALE',
      invoice_number: saleData.invoice_number,
      sale_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      total_amount: saleData.total_amount,
      payment_method: saleData.payment_method,
      items_count: saleData.items?.length || 1,
      plate_number: saleData.plate_number,
      customer_name: saleData.customer_name,
      mechanic_name: saleData.mechanic_name,
      items_summary: itemsSummary,
      device_id: this.config.clientId,
    };

    return new Promise((resolve) => {
      try {
        this.client?.publish(
          this.config.topic,
          JSON.stringify(payload),
          { qos: 0, retain: false },
          (err) => {
            if (err) {
              console.warn('[MQTT Publish Failed]', err);
              resolve(false);
            } else {
              console.log('[MQTT Published]', this.config.topic, payload.invoice_number);
              resolve(true);
            }
          }
        );
      } catch (e) {
        console.warn('[MQTT Publish Exception]', e);
        resolve(false);
      }
    });
  }

  /**
   * Test sending a sample ping message
   */
  public async testPublish(): Promise<boolean> {
    return this.publishSale({
      invoice_number: 'TEST-' + Math.floor(Math.random() * 9000 + 1000),
      total_amount: 85000,
      payment_method: 'CASH',
      plate_number: 'B 1234 XYZ',
      customer_name: 'Tes Owner',
      mechanic_name: 'Mekanik Demo',
      items: [
        { item_name: 'Oli MPX 2 10W-30 (Tes)', quantity: 1 },
        { item_name: 'Jasa Ganti Oli (Tes)', quantity: 1 },
      ],
    });
  }
}

export const mqttService = new MqttService();
