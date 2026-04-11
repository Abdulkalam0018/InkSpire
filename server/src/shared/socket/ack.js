export function ackSuccess(ack, payload = {}) {
  if (typeof ack === "function") {
    ack({ ok: true, ...payload });
  }
}

export function ackError(ack, payload = {}) {
  if (typeof ack === "function") {
    ack({ ok: false, ...payload });
  }
}
