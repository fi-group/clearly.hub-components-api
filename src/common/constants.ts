export const POPUP_WINDOW_NAME = '__oup_components_popup__';
export const CHANNEL_NAME = '__oup_components_channel__';
export const SETTINGS_KEY = '__oup_components_settings__';
export const CONFIG_KEY = '__oup_components_config__';

export const COMPONENT_LAUNCH = '__oup_components_launch__';
export const REDIRECT_RESULT_KEY = '__oup_components_redirect_result__';

export const DEFAULT_BASE_URL = 'https://hub.clearly.app';
export const DEFAULTS = {
  PUBLIC_KEY_URL: `${DEFAULT_BASE_URL}/.well-known/public-key.pem`,
  COMPONENTS_URL: `${DEFAULT_BASE_URL}/components`,
  TYPE: 'popup',
  DATA_PARAM: '__oup_component_data__',
  SIGNATURE_PARAM: '__oup_component_signature__',
  SIGNATURE_FORMAT: 'jwt',
  REDIRECT_URL: location.origin,
}

