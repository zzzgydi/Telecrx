/**
 * Unified Extension Remote Procedure Call
 */

export default class TeleError extends Error {
  code: number;

  constructor(code: number, message?: string) {
    super();
    this.name = "RPCError";
    this.code = code;
    if (code < 400) throw new Error(`Error code should not less than 400`);
    if (message) this.message = message;
  }

  setMsg(msg: string): TeleError {
    if (msg) this.message = msg;
    return this;
  }

  toResponse(): TeleResponse {
    return { code: this.code, data: null, msg: this.message };
  }
}
