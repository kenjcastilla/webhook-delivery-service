import crypto from "crypto";


export function sign(body: string, secret: string): string {
      return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
   }