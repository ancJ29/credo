import { ApiError } from '../src/api';

/** The calls of the staff pages, for a test of something else: each fails as if the service
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
  getPhoto: down,
  savePhoto: down,
  archiveEmployee: down,
};
