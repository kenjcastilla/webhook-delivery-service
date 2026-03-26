import { sign } from "./signPayload";


it("should generate valid HMAC-SHA256 signature", () => {
   const body = "{'orderId': 123}";
   const secret = "testsecret";
   const signature = sign(body, secret);
   expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
});