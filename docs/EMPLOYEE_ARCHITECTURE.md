# Employee CRUD - Architectural Overview

> **TAJ HRMS Backend - Employee Management Module**  
> This document provides a comprehensive architectural overview of the Employee CRUD operations, including leave balance handling, position management, salary policy management, and related functionalities.

---

## 📁 File Structure

```
taj-hrms-backend/
├── controllers/
│   └── employeeController.js    # Main controller (~1190 lines)
├── models/
│   ├── Employee.js              # Employee model
│   ├── Position.js              # Position model (linked to leave policy)
│   ├── PositionHistory.js       # Position change tracking
│   ├── LeaveBalance.js          # Employee leave balances (yearly)
│   ├── LeavePolicy.js           # Leave entitlements per position
│   ├── SalaryPolicy.js          # Salary components configuration
│   └── SalaryPolicyHistory.js   # Salary policy change tracking
├── routes/
│   └── employeeRoutes.js        # API route definitions
└── middleware/
    └── uploadMiddleware.js      # CNIC image upload handling
```

---

## 🗄️ Data Models

### 1. Employee Model (`Employee.js`)

The central entity representing an employee in the system.

```javascript
{
  // Core References
  position: ObjectId (ref: Position) [REQUIRED],
  salaryPolicy: ObjectId (ref: SalaryPolicy) [OPTIONAL],
  status: Enum ["Active", "Inactive", "Resigned", "Terminated"],
  employeeID: String (auto-generated, format: "TAJ-0001"),

  // Personal Information
  fullName: String [REQUIRED],
  gender: Enum ["Male", "Female"] [REQUIRED],
  fatherName: String,
  husbandName: String,
  joiningDate: Date,
  cnic: String (unique),
  cnicImages: { front: String (Cloudinary URL), back: String },
  dob: Date,
  contactNumber: String,
  province: String,
  city: String,
  maritalStatus: Enum ["Single", "Married", "Divorced", "Widowed"],
  currentStreetAddress: String,
  permanentStreetAddress: String,
  emergencyContact: [{ name, number, relation }],

  // Medical Information
  medical: {
    bloodGroup: String,
    hasHealthIssues: Boolean,
    healthIssueDetails: String,
    disability: Boolean,
    disabilityDetails: String
  },

  // Education
  education: [{ qualification, institute, grades, status }],

  // Professional Experience
  previousExperience: [{ company, position, from, to, lastSalary }],

  // Guarantor
  guarantor: [{ name, contactNumber, cnic, address }],

  // Legal
  legal: {
    involvedInIllegalActivity: Boolean,
    illegalActivityDetails: String,
    convictedBefore: Boolean,
    convictedBeforeDetails: String,
    restrictedPlaces: Boolean,
    restrictedPlacesDetails: String
  }
}
```

### 2. Position Model (`Position.js`)

Defines job positions with leave policy associations.

```javascript
{
  name: String [REQUIRED],
  department: ObjectId (ref: Department) [REQUIRED],
  reportsTo: String,
  leavePolicy: ObjectId (ref: LeavePolicy) [REQUIRED],  // Determines leave entitlements
  employeeLimit: String ("unlimited" or numeric),
  hiredEmployees: Number (auto-managed counter)
}
```

**Key Insight:** Each position is linked to a `LeavePolicy`, which determines the leave entitlements for employees in that position.

### 3. LeaveBalance Model (`LeaveBalance.js`)

Tracks individual employee leave balances per year.

```javascript
{
  employee: ObjectId (ref: Employee) [REQUIRED],
  leaveType: ObjectId (ref: LeaveType) [REQUIRED],
  totalDays: Number,      // Total allocated days
  usedDays: Number,       // Days already used
  remainingDays: Number,  // totalDays - usedDays
  year: Number            // Year for this balance (e.g., 2026)
}
```

**Unique Constraint:** `(employee, leaveType, year)` - One balance per leave type per year per employee.

### 4. PositionHistory Model (`PositionHistory.js`)

Audit trail for position changes.

```javascript
{
  employee: ObjectId (ref: Employee),
  fromPosition: ObjectId (ref: Position) | null,  // null for initial assignment
  toPosition: ObjectId (ref: Position),
  changedBy: ObjectId (ref: User),
  changedAt: Date,
  effectiveDate: Date,
  reason: String
}
```

### 5. SalaryPolicyHistory Model (`SalaryPolicyHistory.js`)

Audit trail for salary policy changes.

```javascript
{
  employee: ObjectId (ref: Employee),
  fromSalaryPolicy: ObjectId (ref: SalaryPolicy) | null,
  toSalaryPolicy: ObjectId (ref: SalaryPolicy),
  changedBy: ObjectId (ref: User),
  changedAt: Date,
  effectiveDate: Date,
  reason: String
}
```

### 6. LeavePolicy Model (`LeavePolicy.js`)

Defines leave entitlements that can be assigned to positions.

```javascript
{
  name: String [REQUIRED, UNIQUE],
  entitlements: [{
    leaveType: ObjectId (ref: LeaveType),
    days: Number (minimum: 0)
  }],
  status: Enum ["Approved", "Pending", "Rejected"],
  createdBy: String
}
```

### 7. SalaryPolicy Model (`SalaryPolicy.js`)

Defines salary components and amounts.

```javascript
{
  name: String [REQUIRED, UNIQUE],
  components: [{
    salaryComponent: ObjectId (ref: SalaryComponent),
    amount: Number (minimum: 0)
  }],
  status: Enum ["Approved", "Pending", "Rejected"],
  createdBy: String
}
```

---

## 🛣️ API Routes

| Method  | Route                                     | Description                             | Access |
| ------- | ----------------------------------------- | --------------------------------------- | ------ |
| `GET`   | `/api/employees`                          | Get all employees (paginated)           | Admin  |
| `GET`   | `/api/employees/list`                     | Get employees for dropdowns             | Admin  |
| `GET`   | `/api/employees/:id`                      | Get single employee with leave balances | Admin  |
| `POST`  | `/api/employees`                          | Create new employee                     | Admin  |
| `PUT`   | `/api/employees/:id`                      | Update employee                         | Admin  |
| `PATCH` | `/api/employees/:id/status`               | Change employee status                  | Admin  |
| `PATCH` | `/api/employees/:id/position`             | Change employee position                | Admin  |
| `PATCH` | `/api/employees/:id/salary-policy`        | Change salary policy                    | Admin  |
| `GET`   | `/api/employees/:id/position-history`     | Get position history                    | Admin  |
| `GET`   | `/api/employees/:id/salary-history`       | Get salary policy history               | Admin  |
| `GET`   | `/api/employees/:id/leave-balances`       | Get leave balances by year              | Admin  |
| `POST`  | `/api/employees/:id/renew-leave-balances` | Renew leave balances for new year       | Admin  |
| `POST`  | `/api/employees/renew-all-leave-balances` | Bulk renew for all active employees     | Admin  |

---

## 🔄 Core Business Logic

### 1. Employee Creation (`createEmployee`)

**Flow:**

```
1. Validate required fields (fullName, position, gender)
2. Validate position exists and has leave policy
3. Check position employee limit
4. Validate salary policy (if provided)
5. Check for duplicate CNIC
6. Generate employee ID (TAJ-0001 format)
7. Upload CNIC images to Cloudinary
8. Create Employee record
9. Increment position's hiredEmployees count
10. Create LeaveBalances based on position's leave policy
11. Create initial PositionHistory record
12. Create initial SalaryPolicyHistory record (if salary policy assigned)
13. Return populated employee with leave balance count
```

**Auto-Generated Employee ID:**

```javascript
// Format: TAJ-XXXX (e.g., TAJ-0001, TAJ-0002)
const generateEmployeeId = async () => {
  const lastEmployee = await Employee.findOne()
    .sort({ createdAt: -1 })
    .select("employeeID");
  // Increment from last ID or start at TAJ-0001
};
```

### 2. Leave Balance Creation (`createLeaveBalances`)

**Triggered When:**

- New employee is created
- Employee position changes (with different leave policy)
- Yearly leave balance renewal

**Logic:**

```javascript
// For each entitlement in position's leave policy:
{
  employee: employeeId,
  leaveType: entitlement.leaveType._id,
  totalDays: entitlement.days,
  usedDays: 0,
  remainingDays: entitlement.days,
  year: currentYear
}
```

### 3. Position Change (`changeEmployeePosition`)

**This is the most complex operation, handling:**

1. **Validation**

   - Validate new position exists
   - Check new position's employee limit

2. **Position Counter Management**

   - Decrement `hiredEmployees` on old position
   - Increment `hiredEmployees` on new position

3. **Leave Balance Adjustment (Pro-rated)**

   When leave policy changes, the system calculates prorated adjustments:

   ```javascript
   // Calculate proration factor
   const daysRemainingInYear = (endOfYear - effectiveDate) / totalDaysInYear;
   const prorationFactor = daysRemainingInYear / totalDaysInYear;
   ```

   **Scenarios:**

   | Scenario                                               | Action                                 |
   | ------------------------------------------------------ | -------------------------------------- |
   | Leave type exists in both policies, new has MORE days  | Add prorated difference to remaining   |
   | Leave type exists in both policies, new has FEWER days | Reduce total (but preserve used days)  |
   | Leave type only in new policy                          | Create new prorated balance            |
   | Leave type only in old policy                          | Keep existing (frozen, no new accrual) |

   **Example:**

   ```
   Effective Date: July 1st (183 days remaining in year)
   Proration Factor: 183/365 = 0.501

   Old Policy: Annual Leave = 10 days
   New Policy: Annual Leave = 20 days

   Additional Days = (20 - 10) * 0.501 = 5 days (rounded)
   New Total = 10 + 5 = 15 days
   ```

4. **History Tracking**
   - Create `PositionHistory` record with effective date and reason

### 4. Salary Policy Change (`changeEmployeeSalaryPolicy`)

**Flow:**

```
1. Validate employee exists
2. Validate new salary policy exists
3. Create SalaryPolicyHistory record
4. Update employee's salaryPolicy reference
```

### 5. Status Change (`changeEmployeeStatus`)

**Status Options:** `Active`, `Inactive`, `Resigned`, `Terminated`

**Position Counter Logic:**

```javascript
if (previousStatus === "Active" && newStatus !== "Active") {
  // Decrement hired count (employee leaving active workforce)
  position.hiredEmployees -= 1;
}
if (previousStatus !== "Active" && newStatus === "Active") {
  // Increment hired count (employee returning to active)
  position.hiredEmployees += 1;
}
```

### 6. Leave Balance Renewal (`renewEmployeeLeaveBalances`)

**For New Year:**

```
1. Get employee's current position and leave policy
2. Check if balances already exist for target year
3. Create fresh balances based on current leave policy entitlements
4. All balances start with usedDays = 0, remainingDays = totalDays
```

**Bulk Renewal (`renewAllEmployeesLeaveBalances`):**

```
1. Get all active employees
2. For each employee:
   - Skip if no leave policy
   - Skip if balances already exist for year
   - Create new balances
3. Return summary with success/skipped/error counts
```

---

## 🖼️ CNIC Image Handling

**Upload Middleware:**

```javascript
const uploadCnicImages = upload.fields([
  { name: "cnicFront", maxCount: 1 },
  { name: "cnicBack", maxCount: 1 },
]);
```

**Cloudinary Storage:**

```javascript
// Path structure: taj-hrms/employees/{employeeID}/cnic/{front|back}
const result = await uploadToCloudinary(
  buffer,
  `taj-hrms/employees/${employeeID}/cnic`,
  "front" // or "back"
);
```

---

## 📊 Query Patterns

### Get All Employees (Paginated)

```javascript
// Search across: fullName, employeeID, cnic
// Filters: (commented out but available) status, position, department
// Pagination: page, limit
// Sort: createdAt descending
// Populate: position → department, salaryPolicy
```

### Get Single Employee

```javascript
// Deep population:
Employee.findById(id)
  .populate({
    path: "position",
    select: "name department leavePolicy",
    populate: [
      { path: "department", select: "name" },
      { path: "leavePolicy", select: "name" },
    ],
  })
  .populate({
    path: "salaryPolicy",
    select: "name components",
    populate: { path: "components.salaryComponent", select: "name type" },
  });

// + LeaveBalances query (sorted by year descending)
```

### Get Leave Balances

```javascript
// Query by employee ID
// Optional filter by year
// Groups results by year for client convenience
LeaveBalance.find({ employee: id, year: year })
  .populate("leaveType", "name isPaid")
  .sort({ year: -1 });
```

---

## 🔗 Entity Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              EMPLOYEE                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ _id, employeeID, fullName, status, cnic, joiningDate, etc.       │   │
│  └───────────────────┬───────────────────────┬──────────────────────┘   │
│                      │                       │                          │
│                      ▼                       ▼                          │
│              ┌──────────────┐        ┌────────────────┐                 │
│              │   POSITION   │        │ SALARY POLICY  │                 │
│              │   (1:M)      │        │    (1:M)       │                 │
│              └──────┬───────┘        └───────┬────────┘                 │
│                     │                        │                          │
│                     ▼                        ▼                          │
│              ┌──────────────┐        ┌────────────────┐                 │
│              │ LEAVE POLICY │        │ SALARY HISTORY │                 │
│              │              │        │                │                 │
│              └──────┬───────┘        └────────────────┘                 │
│                     │                                                   │
│                     ▼                                                   │
│        ┌────────────────────────────────────────────────────────────┐   │
│        │                     LEAVE BALANCE                           │   │
│        │  (Per Employee, Per LeaveType, Per Year)                    │   │
│        │  totalDays | usedDays | remainingDays | year                │   │
│        └────────────────────────────────────────────────────────────┘   │
│                                                                         │
│        ┌────────────────────────────────────────────────────────────┐   │
│        │                   POSITION HISTORY                          │   │
│        │  Tracks: fromPosition → toPosition, effectiveDate, reason   │   │
│        └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Important Business Rules

### 1. Position Employee Limit

- Positions can have `"unlimited"` or a numeric limit
- System prevents hiring beyond the limit
- Counter is auto-managed on create/delete/status change/position change

### 2. CNIC Uniqueness

- CNIC must be unique across all employees
- Validated on both create and update operations

### 3. Leave Balance Yearly Isolation

- Balances are year-specific
- Compound unique index: `(employee, leaveType, year)`
- No automatic carry-over (manual renewal required)

### 4. Position Change Pro-ration

- Leave adjustments are calculated based on remaining days in year
- Used days are NEVER reduced (preserved employee rights)
- New leave types are pro-rated based on effective date

### 5. History Tracking

- All position changes create PositionHistory records
- All salary policy changes create SalaryPolicyHistory records
- Initial assignments are tracked (with `fromPosition: null`)

---

## 🔐 Security & Access Control

- All routes protected by `protect` middleware (authenticated users only)
- All routes authorized for `ROLES.admin` only
- Uses Express async error handling pattern
- Input validation for MongoDB ObjectId format

---

## 📝 Response Patterns

### Success Responses

**Create Employee:**

```json
{
  "employee": {
    /* populated employee object */
  },
  "leaveBalancesCreated": 3
}
```

**Position Change:**

```json
{
  "message": "Employee position changed successfully",
  "employee": {
    /* populated employee */
  },
  "leaveBalanceChanges": [
    {
      "leaveType": "Annual",
      "action": "increased",
      "oldTotal": 10,
      "newTotal": 15
    }
  ],
  "effectiveDate": "2026-07-01T00:00:00.000Z"
}
```

**Leave Balance Renewal (Bulk):**

```json
{
  "message": "Bulk leave balance renewal completed for year 2026",
  "year": 2026,
  "summary": {
    "totalProcessed": 50,
    "successful": 45,
    "skipped": 3,
    "errors": 2
  },
  "results": {
    /* detailed success/skipped/error arrays */
  }
}
```

---

## 🚀 Future Considerations

1. **Leave Carry-Over:** Implement optional carry-over logic for unused leave days
2. **Audit Logging:** Extend history tracking to include field-level changes
3. **Department Filters:** Uncomment and enable department-based filtering
4. **Leave Accrual:** Implement monthly accrual instead of yearly lump sum
5. **Probation Period:** Handle different leave entitlements during probation

---

_Last Updated: January 2026_
