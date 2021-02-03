/**
 * Communication between various
 * parts of the chrome extensions
 */

declare type TeleFlag = "tab" | "popup" | "background";

declare type TeleParams<T = any> = {
  name: string;
  data?: T;
  to?: TeleFlag;
  tabId?: number;
  noAsync?: boolean;
};

declare interface TeleResponse<T = any> {
  code: number;
  data: T | null;
  msg?: string;
}

declare interface TeleRequest<T = any> {
  name: string;
  data: T | null;
  from: TeleFlag;
  to: TeleFlag;
  redirect?: string;
  sender?: chrome.runtime.MessageSender;
}

declare type TeleListener<T = any, P = any> = (
  request: TeleRequest<T>
) => Promise<P> | P;

declare type TeleInnerRequest<T = any> = TeleRequest<T> & {
  code: number;
};

declare type TeleInnerListener<T = any, P = any> = (
  request: TeleRequest<T>
) => Promise<TeleResponse<P>> | TeleResponse<P>;

declare type TeleInnerEvent<T = any, P = any> = TeleRequest<T> & {
  cb: (res?: TeleResponse<P>) => void;
};

declare interface Window {
  __TelecrxEvent: (request: TeleInnerEvent) => void;
}
