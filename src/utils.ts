/**
 * Unified Extension Remote Procedure Call
 */

import type Telecrx from "./index";
import TeleError from "./error";

export enum TeleCode {
  Ok = 200,
  // functional
  Redirect = 303,
  // error
  NullName = 400,
  NullId = 401,
  RedirectError = 403,
  NotFound = 404,
  Error = 500,
}

export const TeleError403 = new TeleError(403, "redirect error");
export const TeleError404 = new TeleError(404, "method not found");
export const TeleError500 = new TeleError(500, "unhandled error");

// key hash
export function mapKeyHash(name: string, flag: string): string {
  return `${name}[[${flag}]]`;
}

// get rand string
export function randString(num: number): string {
  const source =
    "qwertyuiopasdfghjklzxcvbnm1234567890ZXCVBNMASDFGHJKLQWERTYUIOP";
  const arr = [];
  const len = source.length;
  for (let i = 0; i < num; i++) {
    const index = Math.floor(Math.random() * len);
    arr.push(source[index]);
  }
  return arr.join("");
}

// get rand redirect name
export function redirectName(name: string): string {
  return `${name}_#${randString(6)}`;
}

export function sendFactory(
  request: TeleRequest,
  tabId?: number
): Promise<TeleResponse> {
  return new Promise<TeleResponse>((resolve, reject) => {
    const errorRes500 = TeleError500.toResponse();
    const wrapper = (response: TeleResponse = errorRes500) => {
      if (chrome.runtime.lastError) reject(errorRes500);
      else if (response.code < 400) resolve(response);
      else reject(response);
    };
    if (tabId == null) chrome.runtime.sendMessage(request, wrapper);
    else chrome.tabs.sendMessage(tabId, request, wrapper);
  });
}

export function sendAsyncFactory(
  tele: Telecrx,
  request: TeleRequest,
  tabId?: number
): Promise<TeleResponse> {
  return new Promise<TeleResponse>((resolve, reject) => {
    const errorRes500 = TeleError500.toResponse();
    try {
      // async rediect name
      const redirect = redirectName(request.name);
      // set redirect
      request.redirect = redirect;
      // register an function for possible async response
      const redirectFn = (fnreq: TeleRequest) => {
        tele.unlisten(redirect, request.to); // unregister
        resolve(fnreq.data);
        return "rediect ok";
      };
      tele.listen(redirect, request.to, redirectFn);
      const wrapper = (response: TeleResponse = errorRes500) => {
        if (chrome.runtime.lastError) return reject(errorRes500);
        if (response.code === 303) return;
        if (response.code < 400) resolve(response);
        else reject(response);
        tele.unlisten(redirect, request.to); // unregister
      };
      if (tabId == null) chrome.runtime.sendMessage(request, wrapper);
      else chrome.tabs.sendMessage(tabId, request, wrapper);
    } catch {
      reject(errorRes500);
    }
  });
}
