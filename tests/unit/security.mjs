// Security unit tests: password policy, injection-looking input rejected by validators, CSV formula safety.
import { passwordSchema } from "../../src/lib/validators/password.js";
import { patientSchema } from "../../src/lib/validators/patient.js";
import { userCreateSchema } from "../../src/lib/validators/user.js";
import { toCsv } from "../../src/lib/utils/csv.js";
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS", n); } else { fail++; console.log("  FAIL", n); } };

for (const [label, pw] of [["too short", "Ab1!"], ["no uppercase", "lowercase1!xx"], ["no lowercase", "UPPERCASE1!XX"], ["no digit", "NoDigitsHere!!"], ["no special", "NoSpecial12345"], ["empty", ""]])
  ok(`password policy rejects: ${label}`, !passwordSchema.safeParse(pw).success);
ok("password policy accepts a strong password", passwordSchema.safeParse("Str0ng!Passw0rd").success);

const base = { first_name: "Maria", last_name: "Santos", birthdate: "1990-03-14", sex: "female", contact_no: "09171234567", address: "", emergency_contact_name: "", emergency_contact_no: "" };
ok("valid patient accepted", patientSchema.safeParse(base).success);
ok("SQL text in contact_no rejected", !patientSchema.safeParse({ ...base, contact_no: "1'; DROP TABLE patients;--" }).success);
ok("invalid sex value rejected", !patientSchema.safeParse({ ...base, sex: "x'; --" }).success);
ok("invalid role rejected (privilege escalation)", !userCreateSchema.safeParse({ full_name: "A B", email: "a@b.co", password: "Str0ng!Passw0rd", role: "superadmin", specialization: "", license_no: "" }).success);

const csv = toCsv([{ key: "a", header: "A" }], [{ a: "=cmd|' /C calc'!A0" }, { a: "@SUM(1)" }, { a: "+1+1" }]);
ok("CSV neutralises = formulas", csv.includes("'=cmd"));
ok("CSV neutralises @ formulas", csv.includes("'@SUM"));
ok("CSV neutralises + formulas", csv.includes("'+1+1"));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
