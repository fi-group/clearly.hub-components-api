interface Settings {
  publicKeyUrl?: string;
  componentsUrl?: string;
  popup?: {
    position?: 'left' | 'center' | 'right';
    height?: number
  };
}

interface Component {
  client_id: string;
  actions: string[];
  param?: string;
  signatureParam?: string;
  signatureFormat?: string;
  type: 'popup' | 'redirect';
  [key: string]: unknown;
}

export interface OpenProps {
  component: Component;
  settings?: Settings;
  callback: (data: Record<string, unknown>) => void;
}

export type OupWindow = Window & {
  oupapi?: {
    components?: {
      open?: (props: OpenProps) => void;
      getRedirectResult?: (callback: (data: Record<string, unknown>) => void) => void;
    }
  }
};
