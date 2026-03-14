import { createThirdwebClient } from "thirdweb";

const secretKey = process.env.THIRDWEB_SECRET_KEY;
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "6b709648a496639e20d7ac13275ebc15";

export const thirdwebServerClient = createThirdwebClient(
  secretKey ? { secretKey } : { clientId },
);
