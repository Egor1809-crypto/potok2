export type TelegramConnectionInfo = {
  configured: boolean;
  connected: boolean;
  username: string;
  displayName: string;
  subscribeUrl: string;
  subscribers: number;
  lastReceivedAt: string | null;
  message: string;
};
