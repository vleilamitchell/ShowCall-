In the system PostgreSQL, you'll find a database called 'showcall_import'. This is from an older version of this system and the schemas do not match, regardless, import the data into the current DB in the relavant columns, create appropriate joins records, etc.

Critical entities:
- Inventory items
- Events
- REcurring Events
- Schedules
- Shifts
- Assignments
- Positions
- Contacts
- Employees
- Departments
- Areas

Make a new script for this called 'db-import-legacy.js' which crystalizes this process and add documentation to the readme. 