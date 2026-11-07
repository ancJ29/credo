import { ApiError } from '../src/api';

/** The calls of the pages a test is not about (the staff's, and the operator's list), for a test of something else: each fails as if the service
 * were down, so a test that did not mean to call one finds out. */
const down = () => Promise.reject(new ApiError(null));
export const staffCalls = {
  getStaffSetup: down,
  saveStaffSetup: down,
  listEmployees: down,
  getEmployee: down,
  addEmployee: down,
  importEmployees: down,
  listCustomers: down,
  getCustomer: down,
  saveCustomer: down,
  listProducts: down,
  importCustomers: down,
  importProducts: down,
  saveEmployee: down,
  setPassword: down,
  changeCode: down,
  setEmail: down,
  issueQr: down,
  signInQr: down,
  changePassword: down,
  getPhoto: down,
  savePhoto: down,
  archiveEmployee: down,
  restoreEmployee: down,
  listOrders: down,
  getOrder: down,
  createOrder: down,
  saveOrder: down,
  confirmOrder: down,
  sendOrder: down,
  cancelOrder: down,
  listDeliveries: down,
  getDelivery: down,
  cancelDelivery: down,
  listReconciliations: down,
  closeDay: down,
  listDrivers: down,
  myDeliveries: down,
  deliver: down,
  getDeliveryPhoto: down,
  listClients: down,
};

/** The operator's passkey calls, for a test of something else, failing the same way. */
export const passkeyCalls = {
  operatorPasskeyOptions: down,
  operatorPasskeySignIn: down,
  operatorJoinOptions: down,
  operatorJoin: down,
  operatorPasskeys: down,
  operatorPasskeyConfirmOptions: down,
  operatorPasskeyAddOptions: down,
  operatorPasskeyAdd: down,
  operatorPasskeyRemove: down,
};

/** The device's passkeys, for a test of something else: a ceremony fails as if the device refused. */
export const noPasskeys = { register: down, authenticate: down };
