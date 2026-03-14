# Payroll Audit Report — February 2026

## Scope
- Compared attendance-derived expected salary vs generated payroll salary
- Month: **February 2026**
- Employees reviewed: **10**

## Method Used
Expected salary was recomputed using the same payroll calculation rules currently implemented in the backend payroll engine:
- Shift-based scheduled working days
- Attendance classification (`Present`, `Late`, `Half Day`, `Leave`, `Absent`, `Off`)
- Paid/unpaid leave handling
- Late penalty logic (every 3 lates ⇒ 0.5 day basic deduction)
- Manual deductions in month
- Arrears handled separately; core comparison used gross − late penalty − manual deductions, then validated against total with stored arrears

## Executive Summary
- **Employees in Feb 2026 dataset:** 10
- **Implementation status:** New payroll/attendance boundary rules implemented in backend.
- **Current DB note:** Stored Feb 2026 payroll records count is `0`, so below post-implementation values are recomputed projections from DB attendance + policy data.

## DB Updates Applied (March 14, 2026)
- Applied `Labor` allowance policy to all employees in DB.
- Removed mock allowance artifacts from DB:
   - Deleted policy: `Standard Policy MOCK`
   - Deleted component: `General Allowance MOCK`
- Remaining allowance setup:
   - Policy: `Labor`
   - Components: `Utility Allowance`, `Conveyance Allowance`

## Employee-wise Results (Historical Baseline Before Rule Update)
| Employee ID | Employee Name | Expected Salary (Core) | Generated Salary (Core) | Difference |
|---|---:|---:|---:|---:|
| MOCK-1001 | Mock Perfect | 106000.00 | 106000.00 | 0.00 |
| MOCK-1002 | Mock Mid Joined | 106000.00 | 106000.00 | 0.00 |
| MOCK-1003 | Mock Mid Left | 79500.00 | 79500.00 | 0.00 |
| MOCK-1004 | Mock Has Absents | 79500.00 | 79500.00 | 0.00 |
| MOCK-1005 | Mock Has Half Days | 95400.00 | 95400.00 | 0.00 |
| MOCK-1006 | Mock Has Lates | 103500.00 | 103500.00 | 0.00 |
| MOCK-1007 | Mock Paid Leaves | 106000.00 | 106000.00 | 0.00 |
| MOCK-1008 | Mock Unpaid Leaves | 90100.00 | 90100.00 | 0.00 |
| MOCK-1009 | Mock Manual Deductions | 101000.00 | 101000.00 | 0.00 |
| MOCK-1010 | Mock Complex Mix | 82176.47 | 82176.47 | 0.00 |

## Post-Implementation Feb 2026 Projection (New Rules)

Applied rules:
- Per-day divisor uses **full-month scheduled working days**.
- Attendance/payroll windows are bounded by employment dates (`joiningDate` / `resignationDate`).
- Allowance paid via **allowance ratio** (`payableUnits / scheduledDays`) on total allowance.
- Every 3 lates causes 0.5-day penalty on **both** basic and allowance.

| Employee ID | Employee Name | Scheduled Days | Payable Units | Basic (PKR) | Allowance (PKR) | Late Penalty (PKR) | Manual Deduction (PKR) | Projected Total (PKR) |
|:--|:--|--:|--:|--:|--:|--:|--:|--:|
| MOCK-1001 | Mock Perfect | 20 | 20.0 | 100000.00 | 6000.00 | 0.00 | 0.00 | 106000.00 |
| MOCK-1002 | Mock Mid Joined | 20 | 14.0 | 70000.00 | 4200.00 | 0.00 | 0.00 | 74200.00 |
| MOCK-1003 | Mock Mid Left | 20 | 15.0 | 75000.00 | 4500.00 | 0.00 | 0.00 | 79500.00 |
| MOCK-1004 | Mock Has Absents | 20 | 15.0 | 75000.00 | 4500.00 | 0.00 | 0.00 | 79500.00 |
| MOCK-1005 | Mock Has Half Days | 20 | 18.0 | 90000.00 | 5400.00 | 0.00 | 0.00 | 95400.00 |
| MOCK-1006 | Mock Has Lates | 20 | 20.0 | 100000.00 | 6000.00 | 2650.00 | 0.00 | 103350.00 |
| MOCK-1007 | Mock Paid Leaves | 20 | 20.0 | 100000.00 | 6000.00 | 0.00 | 0.00 | 106000.00 |
| MOCK-1008 | Mock Unpaid Leaves | 20 | 17.0 | 85000.00 | 5100.00 | 0.00 | 0.00 | 90100.00 |
| MOCK-1009 | Mock Manual Deductions | 20 | 20.0 | 100000.00 | 6000.00 | 0.00 | 5000.00 | 101000.00 |
| MOCK-1010 | Mock Complex Mix | 20 | 13.5 | 67500.00 | 4050.00 | 0.00 | 2000.00 | 69550.00 |

## Manual Calculation Breakdown
Use this section for hand-calculation cross-check.

| Employee ID | Employee Name | Scheduled Working Days | Present Days | Off Days | Late Days | Half Days | Basic Salary (Earned) | Allowances (Earned - Labor Policy) | Deductions (PKR) |
|:--|:--|--:|--:|--:|--:|--:|--:|--:|--:|
| MOCK-1001 | Mock Perfect | 20 | 20 | 8 | 0 | 0 | 100000.00 | 6000.00 | 0.00 |
| MOCK-1002 | Mock Mid Joined | 20 | 14 | 5 | 0 | 0 | 70000.00 | 4200.00 | 0.00 |
| MOCK-1003 | Mock Mid Left | 20 | 15 | 5 | 0 | 0 | 75000.00 | 4500.00 | 0.00 |
| MOCK-1004 | Mock Has Absents | 20 | 15 | 8 | 0 | 0 | 75000.00 | 4500.00 | 0.00 |
| MOCK-1005 | Mock Has Half Days | 20 | 16 | 8 | 0 | 4 | 90000.00 | 5400.00 | 0.00 |
| MOCK-1006 | Mock Has Lates | 20 | 16 | 8 | 4 | 0 | 100000.00 | 6000.00 | 0.00 |
| MOCK-1007 | Mock Paid Leaves | 20 | 17 | 8 | 0 | 0 | 100000.00 | 6000.00 | 0.00 |
| MOCK-1008 | Mock Unpaid Leaves | 20 | 17 | 8 | 0 | 0 | 85000.00 | 5100.00 | 0.00 |
| MOCK-1009 | Mock Manual Deductions | 20 | 20 | 8 | 0 | 0 | 100000.00 | 6000.00 | 5000.00 |
| MOCK-1010 | Mock Complex Mix | 20 | 10 | 7 | 1 | 1 | 67500.00 | 4050.00 | 2000.00 |

## Detailed Observations
- New formula uses full-month scheduled days and payable-unit ratio for allowances.
- `MOCK-1010` now computes to the expected `69550.00` (`67500 + 4050 - 2000`).
- Late penalty now impacts allowance too (example: `MOCK-1006` includes `150.00` allowance-side late penalty).
- Attendance marking/view logic now blocks/hides dates outside employment boundaries.

## Issues Identified
No remaining formula mismatch found for the Feb 2026 target scenarios after implementation.

### Potential Policy/Process Risks (Not bugs in current output)
1. **Join-month pro-rating ambiguity**
   - Employee `MOCK-1002` (“Mid Joined”) receives full monthly amount under current formula because per-day calculation uses scheduled days in active assignment window.
   - If company policy expects calendar-month pro-rating, this could be a policy mismatch.

2. **Exit/offboarding dependency on shift end-date discipline**
   - Employee `MOCK-1003` (“Mid Left”) scenario can lead to absences if shift assignment remains open after employee leaves.
   - This is process-sensitive and can affect payroll fairness.

## Proposed Fixes (Do Not Apply Yet)
1. **Document and enforce join/leave month salary policy**
   - Decide explicitly: full assignment-window salary vs full-calendar-month pro-rating.
   - Reflect decision in payroll policy docs and payroll UI help text.

2. **Automate shift closure on employment end**
   - On resignation/termination, auto-set `EmployeeShift.endDate` to last working date.
   - Add validation to block payroll generation if terminated employee has open future shift assignments.

3. **Add recurring payroll audit check**
   - Add a monthly validation script/report (read-only) that compares expected vs generated payroll and flags policy anomalies even when numeric diff is zero.

## Conclusion
Backend implementation is updated to the requested policy rules. Feb 2026 projection values now reflect full-month divisor, allowance ratio, and late-penalty-on-allowance behavior. Generate payroll for Feb 2026 to persist these projected totals.
