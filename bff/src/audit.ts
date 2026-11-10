/** Who an entry names: `employee.<id>`, or `root` (the root has no employee id). Three kinds
 * cannot collide, `operator.<id>` being the third. */
export const actorOf = (who: { employeeId?: string | null }) =>
  who.employeeId ? `employee.${who.employeeId}` : 'root';
