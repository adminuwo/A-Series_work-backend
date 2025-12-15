import db  from "../db/db";
import activateVendorAccess  from "./vendorGateway";

async function handlePaymentSuccess(payload) {
  const {
    user_id,
    vendor_id,
    plan,
    credits,
    transaction_id
  } = payload;

  // 1. Store payment in DB
  await db.payments.push({
    user_id,
    vendor_id,
    plan,
    credits,
    transaction_id,
    status: "PAID",
    paid_at: new Date()
  });

  // 2. Update user subscription
  await db.subscriptions.push({
    user_id,
    vendor_id,
    plan,
    credits,
    active: true
  });

  // 3. Notify Vendor App
  await activateVendorAccess({
    user_id,
    vendor_id,
    plan,
    credits
  });
}

export default  handlePaymentSuccess 
