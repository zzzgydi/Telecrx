import TeleError from "./error";
import {
  mapKeyHash,
  sendFactory,
  sendAsyncFactory,
  TeleError403,
  TeleError404,
  TeleError500,
  TeleCode,
} from "./utils";

/**
 * Communication between various
 * parts of the chrome extensions
 */
export default class Telecrx {
  static ValidFlags: string[] = ["tab", "popup", "background"];

  readonly flag: TeleFlag;
  private map: Map<string, TeleListener>;

  constructor(flag: TeleFlag) {
    this.flag = flag;
    this.map = new Map();
    const handler = this.handler.bind(this);
    chrome.runtime.onMessage.addListener(handler);

    // popup listener
    if (flag === "popup") {
      const HELP_RPC_EVENT = "__telecrx_event__";
      if (!window.__TelecrxEvent) {
        window.__TelecrxEvent = function (request: TeleInnerEvent) {
          const detail = { detail: request };
          const event = new CustomEvent(HELP_RPC_EVENT, detail);
          window.dispatchEvent(event);
        };
      }
      // background -> popup
      window.addEventListener(
        HELP_RPC_EVENT,
        (event: CustomEventInit<TeleInnerEvent>) => {
          const evtReq = event.detail;
          if (!evtReq) return;
          // trigger methods
          const { cb: sendResponse, ...req } = evtReq;
          this.handler(req, undefined, sendResponse);
        }
      );
    }
  }

  // trigger listener
  private trigger(
    name: string,
    from: string,
    request: TeleRequest
  ): Promise<TeleResponse> | TeleResponse {
    const key = mapKeyHash(name, from);
    const fn = this.map.get(key);
    if (!fn) return TeleError404.toResponse();
    try {
      const result = fn(request) ?? null;
      if (!(result instanceof Promise)) return { code: 200, data: result };
      return result
        .then((data = null) =>
          data instanceof TeleError ? data.toResponse() : { code: 200, data }
        )
        .catch((err) => TeleError500.setMsg(err.message).toResponse());
    } catch (error) {
      if (error instanceof TeleError) return error.toResponse();
      return TeleError500.setMsg(error.message).toResponse();
    }
  }

  // handle listener
  private handler(
    request: TeleRequest,
    sender: chrome.runtime.MessageSender | undefined,
    sendResponse: (res: TeleResponse) => void
  ) {
    const { name, from, to, redirect = "" } = request;
    // pass when request does not send to self
    if (to && this.flag !== to) return;
    // process trigger
    const response = this.trigger(name, from, { ...request, sender });
    // sync method response directly
    if (!(response instanceof Promise)) return sendResponse(response);
    // async method response
    const tabId = sender?.tab?.id;
    if ((from === "tab" && !tabId) || !redirect) {
      return sendResponse(TeleError403.toResponse());
    }
    // just wait
    sendResponse({ code: TeleCode.Redirect, data: null });
    // promise fulfilled
    response.then((res) => {
      const params: TeleParams = {
        name: redirect,
        data: res,
        to: from,
        tabId,
        noAsync: true,
      };
      this.send(params);
    });
  }

  private send2self(request: TeleRequest): Promise<TeleResponse> {
    const { name, from } = request;
    const response = this.trigger(name, from, request);
    if (response instanceof Promise) return response;
    return Promise.resolve(response);
  }

  send<T>(params: TeleParams<T>): Promise<TeleResponse>;
  send<T>(
    name: string,
    data?: T,
    params?: Partial<TeleParams>
  ): Promise<TeleResponse>;

  async send<T>(
    arg1: TeleParams<T> | string,
    arg2?: T,
    arg3?: Partial<TeleParams>
  ): Promise<TeleResponse> {
    let params = null;
    if (typeof arg1 === "object") params = arg1;
    else params = { name: arg1, data: arg2 || null, ...(arg3 || {}) };
    const { name, data = null, tabId, to, noAsync = false } = params;
    // name should not be null
    if (!name) return Promise.reject(new TeleError(TeleCode.NullName));

    const from = this.flag;
    const request = { name, data, from, to } as TeleRequest;

    // case to is null
    if (!to) {
      console.warn("'to' is null");
      return this.send2self(request);
    }
    // case to tab
    if (to === "tab") {
      // tab -> tab
      if (from === "tab") return this.send2self(request);
      if (tabId == null) return Promise.reject(new TeleError(TeleCode.NullId));
      // background, popup -> tab
      if (noAsync) return sendFactory(request, tabId);
      return sendAsyncFactory(this, request, tabId);
    }
    // case to self
    if (to === from) {
      // popup      -> popup
      // background -> background
      return this.send2self(request);
    }
    // case background to popup
    if (to === "popup" && from === "background") {
      // background -> popup
      return new Promise((resolve, reject) => {
        const cb = (res?: TeleResponse) => {
          if (!res)
            reject(TeleError500.setMsg("popup response error").toResponse());
          else resolve(res);
        };
        try {
          const popups = chrome.extension.getViews({ type: "popup" });
          if (popups.length === 0) cb(TeleError404.toResponse());
          else {
            const event = { ...request, cb };
            popups.forEach((popup) => popup.__TelecrxEvent(event));
          }
        } catch (error) {
          reject(TeleError500.setMsg("exec error").toResponse());
        }
      });
    }

    // popup -> background
    // tab   -> background
    // tab   -> popup
    if (noAsync) return sendFactory(request);
    return sendAsyncFactory(this, request);
  }

  listen(name: string, from: TeleFlag, fn: TeleListener): void {
    const key = mapKeyHash(name, from);
    this.map.set(key, fn);
  }

  unlisten(name: string, from?: TeleFlag): void {
    if (from) {
      const key = mapKeyHash(name, from);
      this.map.delete(key);
    } else {
      Telecrx.ValidFlags.forEach((from) => {
        const key = mapKeyHash(name, from);
        this.map.delete(key);
      });
    }
  }
}
