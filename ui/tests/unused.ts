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
  listClients: down,
};
