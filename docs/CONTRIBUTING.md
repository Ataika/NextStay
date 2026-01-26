---

#  Code Quality & Development Workflow Guide

To maintain high standards and ensure code consistency across the **NextStay** project, we have implemented an automated quality control pipeline. All contributors must follow the workflow and standards outlined below.

---

##  1. Automated Workflow (The "Pre-commit" Way)

We use `pre-commit` hooks to catch errors before they reach the repository. This ensures that every commit is "clean" and follows our architectural standards.

### **Initial Setup**

Every developer must run these commands once to activate the local quality gates:

```bash
# 1. Install the required tools
pip install pre-commit ruff sqlfluff

# 2. Install the git hooks
pre-commit install

```

### **The Daily Cycle**

1. **Stage your changes:** `git add .`
2. **Attempt to commit:** `git commit -m "your message"`
3. **Automatic Check:** * If the checks **Pass**, your commit is successful.
* If the checks **Fail**, the linter will often **auto-fix** the files.
* **If auto-fixed:** Run `git add .` again to stage the fixes and then `git commit`.



---

##  2. Technical Standards

### **Python (Linter: Ruff)**

Our Python standards are based on **PEP 8**, enforced by **Ruff**.

* **Line Length:** Maximum **120 characters**.
* **Imports:** * No wildcard imports (`from module import *`).
* Imports must be sorted (Standard library first, then 3rd party, then local modules).


* **Variable Naming:** * Functions & Variables: `snake_case`
* Classes: `PascalCase`


* **Logic:**
* Always use `is None` or `is not None` for null checks (never `== None`).
* No unused variables or dead code (the linter will automatically remove them).



### **SQL & dbt (Linter: SQLFluff)**

To keep our data warehouse readable and professional:

* **Keywords:** Must be **UPPERCASE** (e.g., `SELECT`, `FROM`, `JOIN`, `WHERE`).
* **Indentation:** 4 spaces (no tabs).
* **Alias:** Use explicit `AS` for column aliasing.
* **Reserved Words:** Avoid using reserved words as identifiers (e.g., `user`, `order`). If necessary, wrap them in double quotes `"user"`.

---

##  3. Configuration Files

The behavior of our quality tools is defined in two main files:

1. **`.pre-commit-config.yaml`**: Manages the integration with Git. It is configured to ignore legacy SQL dumps and large data files via the `exclude` pattern.
2. **`pyproject.toml`**: Contains the specific rules for the Ruff linter (e.g., ignoring `E231` for Database URLs).

---

##  4. Security

Our pipeline includes a **Secret Detection** hook.

* **NEVER** commit API keys, database passwords, or private keys.
* If the `detect-private-key` hook fails, remove the sensitive data, move it to a `.env` file, and restage.
