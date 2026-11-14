/* ================= ADMIN ================= */
function isClinicAdminRole(role) {
  return hasClinicAdminPrivileges(role);
}
function canManageClinicAccounts() {
  return isClinicAdminRole(state.currentUser?.role);
}
function renderAdmin() {
  return `
  <div class="subtabs">
    <button class="subtab ${state.adminTab === "users" ? "active" : ""}" data-atab="users">User Management</button>
    <button class="subtab ${state.adminTab === "audit" ? "active" : ""}" data-atab="audit">Audit Logs</button>
    <button class="subtab ${state.adminTab === "deleted" ? "active" : ""}" data-atab="deleted">Archive</button>
  </div>
  <div id="admin-body"></div>
  <div class="admin-back-actions"><button class="btn admin-back-btn" id="admin-back-btn" type="button">Back</button></div>`;
}
function renderUsersTab() {
  const canManageAccounts = canManageClinicAccounts();
  const rows = state.users
    .map(
      (u) => `
    <tr>
      <td>${canManageAccounts ? `<button class="user-detail-link" type="button" data-view-user="${escapeHtml(u.id)}">${escapeHtml(u.name)}</button>` : escapeHtml(u.name)}</td>
      <td>${u.role}</td>
      <td><span class="chip ${u.status === "Active" ? "chip-available" : "chip-void"}">${u.status}</span></td>
      ${
        canManageAccounts && !isProtectedSuperAdmin(u)
          ? `<td><div class="row-actions">
        <button class="mini-btn" data-edit-user="${u.id}" title="Edit">${ICONS.edit}</button>
        <button class="mini-btn" data-toggle-user="${u.id}" title="${u.status === "Active" ? "Disable" : "Enable"}">${u.status === "Active" ? ICONS.x : ICONS.check}</button>
        ${u.id === state.currentUser?.id ? "" : `<button class="mini-btn" data-archive-user="${u.id}" title="Move to Archive">${ICONS.archive}</button>`}
      </div></td>`
          : canManageAccounts
            ? `<td><span class="chip chip-available">Permanent account</span></td>`
            : ""
      }
    </tr>`,
    )
    .join("");
  return `
  <div class="card">
    ${canManageAccounts ? `<div class="toolbar" style="justify-content:flex-end;"><button class="btn btn-coral" id="add-user-btn">${ICONS.plus} Add User</button></div>` : ""}
    <div class="table-wrap">
       <table><thead><tr><th>Name</th><th>Role</th><th>Status</th>${canManageAccounts ? "<th></th>" : ""}</tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
  </div>`;
}
function openUserForm(existing = null) {
  if (existing && isProtectedSuperAdmin(existing)) return;
  const isEdit = !!existing;
  const f = existing || {
    id: uid("NRS"),
    lastName: "",
    firstName: "",
    middleInitial: "",
    name: "",
    role: "",
    username: "",
    password: "",
    status: "Active",
  };
  const canChangeOwnPassword =
    isEdit &&
    hasClinicAdminPrivileges(state.currentUser?.role) &&
    state.currentUser.id === f.id;
  const canChangeOtherPasswords =
    isEdit &&
    hasClinicAdminPrivileges(state.currentUser?.role) &&
    state.currentUser.id !== f.id &&
    !isProtectedSuperAdmin(f);
  const parts = (f.name || "").split(",");
  const roles = [
    ["Head Nurse", "Head Nurse"],
    ["Staff Nurse", "Staff Nurse"],
  ];
  if (isEdit && f.role === "Head Nurse & Administrator")
    roles.unshift([
      "Head Nurse & Administrator",
      "Legacy Administrator (unchanged)",
    ]);
  const html = `
  <div class="modal-head"><h3>${isEdit ? "Edit" : "Add"} User</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body">
    <form class="form-grid" id="user-form">
      <div class="f-field"><label>Last Name <span class="req">*</span></label><input type="text" id="uf-lastname" value="${escapeHtml(f.lastName || parts[0] || "")}" required></div>
      <div class="f-field"><label>First Name <span class="req">*</span></label><input type="text" id="uf-firstname" value="${escapeHtml(f.firstName || (parts[1] || "").trim() || "")}" required></div>
      <div class="f-field"><label>Middle Initial</label><input type="text" id="uf-middle" value="${escapeHtml(f.middleInitial || "")}" maxlength="3"></div>
      <div class="f-field"><label>Role <span class="req">*</span></label><select id="uf-role" required><option value="">Select Role</option>${roles.map(([value, label]) => `<option value="${value}" ${f.role === value ? "selected" : ""} ${value === "Head Nurse & Administrator" ? "disabled" : ""}>${label}</option>`).join("")}</select></div>
      <div class="f-field"><label>Username <span class="req">*</span></label><input type="text" id="uf-username" value="${escapeHtml(f.username || "")}" required></div>
      <div class="f-field"><label>Status</label><select id="uf-status" ${isEdit ? "disabled" : ""}>${["Active", "Disabled"].map((s) => `<option ${f.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      ${
        canChangeOwnPassword
          ? `<div class="f-field full"><h4>Change Password</h4><p class="field-hint">Use 8-128 characters without spaces. Verify your current password to continue.</p></div>
      <div class="f-field"><label for="uf-current-password">Current Password</label><div class="input-row"><input type="password" id="uf-current-password" autocomplete="current-password"><button type="button" class="toggle-pw" data-toggle-password="uf-current-password" aria-label="Show current password">${ICONS.eye}</button></div></div>
      <div class="f-field"><label for="uf-change-password">New Password</label><div class="input-row"><input type="password" id="uf-change-password" autocomplete="new-password" minlength="8"><button type="button" class="toggle-pw" data-toggle-password="uf-change-password" aria-label="Show new password">${ICONS.eye}</button></div></div>
      <div class="f-field"><label for="uf-confirm-change-password">Confirm New Password</label><div class="input-row"><input type="password" id="uf-confirm-change-password" autocomplete="new-password" minlength="8"><button type="button" class="toggle-pw" data-toggle-password="uf-confirm-change-password" aria-label="Show password confirmation">${ICONS.eye}</button></div></div>
      <div class="f-field full"><button type="button" class="btn btn-dark" id="uf-password-save">${ICONS.check} Change Password</button></div>`
          : ""
      }
      ${
        canChangeOtherPasswords
          ? `<div class="f-field full"><h4>Change Password</h4><p class="field-hint">Use 8-128 characters without spaces. Password is managed by Supabase Auth.</p></div>
      <div class="f-field"><label for="uf-change-password">New Password</label><div class="input-row"><input type="password" id="uf-change-password" autocomplete="new-password" minlength="8"><button type="button" class="toggle-pw" data-toggle-password="uf-change-password" aria-label="Show new password">${ICONS.eye}</button></div></div>
      <div class="f-field"><label for="uf-confirm-change-password">Confirm New Password</label><div class="input-row"><input type="password" id="uf-confirm-change-password" autocomplete="new-password" minlength="8"><button type="button" class="toggle-pw" data-toggle-password="uf-confirm-change-password" aria-label="Show password confirmation">${ICONS.eye}</button></div></div>
      <div class="f-field full"><button type="button" class="btn btn-dark" id="uf-password-save">${ICONS.check} Change Password</button></div>`
          : ""
      }
      ${
        isEdit
          ? ""
          : `<div class="f-field"><label>Password <span class="req">*</span></label><div class="input-row"><input type="password" id="uf-password" value="" autocomplete="new-password" required><button type="button" class="toggle-pw" data-toggle-password="uf-password" aria-label="Show password">${ICONS.eye}</button></div></div>
      <div class="f-field"><label>Confirm Password <span class="req">*</span></label><div class="input-row"><input type="password" id="uf-confirm" value="" autocomplete="new-password" required><button type="button" class="toggle-pw" data-toggle-password="uf-confirm" aria-label="Show password confirmation">${ICONS.eye}</button></div></div>`
      }
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="uf-save">${ICONS.check} Save User</button></div>`;
  openModal(html);
  document.querySelectorAll("[data-toggle-password]").forEach(
    (btn) =>
      (btn.onclick = () => {
        const input = document.getElementById(btn.dataset.togglePassword);
        if (!input) return;
        const showing = input.type !== "password";
        input.type = showing ? "password" : "text";
        btn.innerHTML = showing ? ICONS.eye : ICONS.eye_off;
        btn.setAttribute(
          "aria-label",
          showing ? "Show password" : "Hide password",
        );
      }),
  );
  let savingPassword = false;
  document
    .getElementById("uf-password-save")
    ?.addEventListener("click", async () => {
      if (savingPassword) return;
      const passwordInput = document.getElementById("uf-change-password");
      const confirmInput = document.getElementById(
        "uf-confirm-change-password",
      );
      const currentPasswordInput = document.getElementById(
        "uf-current-password",
      );
      const password = passwordInput.value,
        confirmPassword = confirmInput.value;
      if (canChangeOwnPassword && !currentPasswordInput.value) {
        toast(
          "Current password required",
          "Enter your current password to continue.",
          "err",
        );
        currentPasswordInput.focus();
        return;
      }
      if (password.length < 8 || password.length > 128) {
        toast(
          "Invalid password",
          "Use between 8 and 128 characters for the new password.",
          "err",
        );
        passwordInput.focus();
        return;
      }
      if (/\s/.test(password)) {
        toast("Invalid password", "Passwords cannot contain spaces.", "err");
        passwordInput.focus();
        return;
      }
      if (password !== confirmPassword) {
        toast(
          "Passwords do not match",
          "Enter the same password in both fields.",
          "err",
        );
        confirmInput.focus();
        return;
      }
      const button = document.getElementById("uf-password-save"),
        label = button.innerHTML;
      savingPassword = true;
      button.disabled = true;
      button.innerHTML = '<span class="button-spinner"></span> Saving...';
      try {
        const response = await fetch(
          `/api/auth/users/${encodeURIComponent(f.id)}/password`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              password,
              confirmPassword,
              ...(canChangeOwnPassword
                ? { currentPassword: currentPasswordInput.value }
                : {}),
            }),
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast(
            "Password update failed",
            result.message || "Unable to update the Supabase password.",
            "err",
          );
          return;
        }
        if (currentPasswordInput) currentPasswordInput.value = "";
        passwordInput.value = "";
        confirmInput.value = "";
        let auditSucceeded = true;
        try {
          await logAudit(
            `Password Changed — ${f.id}`,
            "User Management",
            "Success",
            false,
            true,
            f.id,
          );
        } catch {
          auditSucceeded = false;
        }
        if (auditSucceeded)
          toast(
            "Password changed",
            canChangeOwnPassword
              ? "Your password was updated."
              : `The password for ${f.name} was updated.`,
            "ok",
          );
        else
          toast(
            "Password changed; audit sync failed",
            "The password was updated, but its audit entry could not be recorded.",
            "err",
          );
      } catch (error) {
        toast(
          "Password update failed",
          error.message || "Unable to update the Supabase password.",
          "err",
        );
      } finally {
        savingPassword = false;
        if (button.isConnected) {
          button.disabled = false;
          button.innerHTML = label;
        }
      }
    });
  let savingUser = false;
  document.getElementById("uf-save").onclick = async () => {
    if (savingUser) return;
    savingUser = true;
    const saveButton = document.getElementById("uf-save"),
      saveLabel = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="button-spinner"></span> Saving...';
    try {
      const last = document.getElementById("uf-lastname").value.trim();
      const first = document.getElementById("uf-firstname").value.trim();
      const middle = document.getElementById("uf-middle").value.trim();
      const username = document.getElementById("uf-username").value;
      const role = document.getElementById("uf-role").value;
      const password = document.getElementById("uf-password")?.value || "";
      const confirm = document.getElementById("uf-confirm")?.value || "";
      if (!document.getElementById("user-form").reportValidity()) return;
      if (!last || !first || !username) {
        toast(
          "Missing information",
          "Last name, first name, and username are required.",
          "err",
        );
        return;
      }
      if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
        toast(
          "Invalid username",
          "Use 3-50 letters, numbers, dots, underscores, or hyphens without spaces.",
          "err",
        );
        document.getElementById("uf-username").focus();
        return;
      }
      if (!role) {
        toast("Role required", "Select a role for this user.", "err");
        return;
      }
      if (!isEdit && !password) {
        toast("Password required", "Create a password for this user.", "err");
        return;
      }
      if (password && /\s/.test(password)) {
        toast("Invalid password", "Passwords cannot contain spaces.", "err");
        document
          .getElementById(isEdit ? "uf-change-password" : "uf-password")
          .focus();
        return;
      }
      if (!isEdit && (password.length < 8 || password.length > 128)) {
        toast(
          "Invalid password",
          "Use a password between 8 and 128 characters.",
          "err",
        );
        document.getElementById("uf-password").focus();
        return;
      }
      if (password !== confirm) {
        toast(
          "Passwords do not match",
          "Enter the same password in both fields.",
          "err",
        );
        return;
      }
      const name = `${last}, ${first}${middle ? " " + middle.replace(/\.$/, "") + "." : ""}`;
      const rec = {
        ...f,
        id: f.id,
        name,
        lastName: last,
        firstName: first,
        middleInitial: middle,
        role,
        username,
        status: document.getElementById("uf-status").value,
      };
      if (!isEdit) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastName: last,
            firstName: first,
            middleInitial: middle,
            role: rec.role,
            username,
            password,
            status: rec.status,
          }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          toast(
            "Account creation failed",
            result.message || "Unable to create the Supabase account.",
            "err",
          );
          return;
        }
        const created = await response.json();
        Object.assign(rec, created);
      }
      const previousIndex = state.users.findIndex((user) => user.id === f.id),
        previous = previousIndex >= 0 ? state.users[previousIndex] : null;
      if (isEdit) {
        if (previousIndex < 0) {
          toast(
            "User not found",
            "This user record is no longer available.",
            "err",
          );
          return;
        }
        const response = await fetch(
          `/api/auth/users/${encodeURIComponent(f.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lastName: last,
              firstName: first,
              middleInitial: middle,
              role: rec.role,
              username,
              status: rec.status,
            }),
          },
        );
        const saved = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast(
            "User update failed",
            saved.message || "Unable to save the user account.",
            "err",
          );
          return;
        }
        state.users[previousIndex] = { ...previous, ...saved };
        if (state.currentUser?.id === f.id) {
          Object.assign(state.currentUser, {
            name: saved.name,
            username: saved.username,
            role: saved.role,
            status: saved.status,
          });
          saveAuthSession(
            state.currentUser,
            Boolean(window.localStorage.getItem(AUTH_SESSION_KEY)),
          );
        }
        const auditActions = [`User Updated — ${name}`];
        if (previous.role !== saved.role)
          auditActions.push(
            `User Role Changed — ${name}: ${previous.role} → ${saved.role}`,
          );
        if (previous.status !== saved.status)
          auditActions.push(
            `User Status Changed — ${name}: ${previous.status} → ${saved.status}`,
          );
        let auditSucceeded = true;
        for (const action of auditActions) {
          try {
            await logAudit(
              action,
              "User Management",
              "Success",
              false,
              true,
              f.id,
            );
          } catch {
            auditSucceeded = false;
          }
        }
        if (auditSucceeded)
          toast("User updated", `${name} has been updated.`, "ok");
        else
          toast(
            "User updated; audit sync failed",
            "The account was updated, but one or more audit entries could not be recorded.",
            "err",
          );
        closeModal();
        renderAdminTabBody();
      } else {
        state.users.unshift(rec);
        let auditSucceeded = true;
        try {
          await logAudit(
            `User Added — ${name}`,
            "User Management",
            "Success",
            false,
            true,
            rec.id,
          );
        } catch {
          auditSucceeded = false;
        }
        if (auditSucceeded)
          toast("User added", `${name} added as ${rec.role}.`, "ok");
        else
          toast(
            "User added; audit sync failed",
            "The account was created, but its audit entry could not be recorded.",
            "err",
          );
        closeModal();
        renderAdminTabBody();
      }
    } catch (error) {
      toast(
        isEdit ? "User update failed" : "Account creation failed",
        error.message || "The user account could not be saved.",
        "err",
      );
    } finally {
      savingUser = false;
      if (saveButton.isConnected) {
        saveButton.disabled = false;
        saveButton.innerHTML = saveLabel;
      }
    }
  };
}
function bindUsersTab() {
  document
    .querySelectorAll("[data-view-user]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          openUserDetails(
            state.users.find((user) => user.id === button.dataset.viewUser),
          )),
    );
  document.getElementById("add-user-btn")?.addEventListener("click", () => openUserForm());
  document
    .querySelectorAll("[data-edit-user]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openUserForm(state.users.find((u) => u.id === b.dataset.editUser))),
    );
  document.querySelectorAll("[data-toggle-user]").forEach((b) => {
    b.onclick = async () => {
      const u = state.users.find((x) => x.id === b.dataset.toggleUser);
      if (!u) return;
      if (isProtectedSuperAdmin(u)) {
        toast("Protected account","The Super Admin maintenance account cannot be disabled.","err");
        return;
      }
      if (u.id === state.currentUser?.id && u.status === "Active") {
        toast(
          "Cannot disable signed-in account",
          "Sign in with another administrator account before disabling this user.",
          "err",
        );
        return;
      }
      if (
        u.status === "Active" &&
        isClinicAdminRole(u.role) &&
        state.users.filter(
          (user) => user.status === "Active" && isClinicAdminRole(user.role),
        ).length <= 1
      ) {
        toast(
          "Administrator required",
          "At least one active Head Nurse or Super Admin account must remain.",
          "err",
        );
        return;
      }
      const previousStatus = u.status,
        nextStatus = u.status === "Active" ? "Disabled" : "Active";
      const updateStatus = () =>
        commitClinicRecordMutation({
          apply: () => {
            u.status = nextStatus;
          },
          rollback: () => {
            u.status = previousStatus;
          },
          auditAction: `User ${nextStatus === "Active" ? "Enabled" : "Disabled"} — ${u.name}`,
          module: "User Management",
          detail: u.id,
          successTitle: `User ${nextStatus.toLowerCase()}`,
          successMessage: `${u.name} is now ${nextStatus.toLowerCase()}.`,
          refresh: renderAdminTabBody,
        });
      if (nextStatus === "Disabled") {
        confirmDialog({
          title: "Are you sure you want to disable this user account?",
          msg: `<b>${escapeHtml(u.name)}</b> will no longer be able to sign in.`,
          okLabel: "Yes, Disable",
          cancelLabel: "Cancel",
          onConfirm: updateStatus,
        });
      } else {
        await updateStatus();
      }
    };
  });
  document.querySelectorAll("[data-archive-user]").forEach((b) => {
    b.onclick = () => {
      const u = state.users.find((x) => x.id === b.dataset.archiveUser);
      if (!u) return;
      if (isProtectedSuperAdmin(u)) {
        toast("Protected account","The Super Admin maintenance account cannot be archived.","err");
        return;
      }
      if (u.id === state.currentUser?.id) {
        toast(
          "Cannot archive signed-in account",
          "Sign in with another administrator account before archiving this user.",
          "err",
        );
        return;
      }
      if (
        u.status === "Active" &&
        isClinicAdminRole(u.role) &&
        state.users.filter(
          (user) => user.status === "Active" && isClinicAdminRole(user.role),
        ).length <= 1
      ) {
        toast(
          "Administrator required",
          "At least one active Head Nurse or Super Admin account must remain.",
          "err",
        );
        return;
      }
      const index = state.users.findIndex((user) => user.id === u.id),
        deleted = { ...u, deleted: true, deletedAt: new Date().toISOString() };
      confirmDialog({
        title: "Are you sure you want to archive this user account?",
        msg: `<b>${escapeHtml(u.name)}</b> will be moved to the Archive and can be restored later.`,
        okLabel: "Yes, Archive",
        cancelLabel: "Cancel",
        onConfirm: async () => {
          await commitClinicRecordMutation({
            apply: () => {
              state.users = state.users.filter((x) => x.id !== u.id);
              DELETED_USERS = DELETED_USERS.filter((x) => x.id !== u.id);
              DELETED_USERS.unshift(deleted);
            },
            rollback: () => {
              DELETED_USERS = DELETED_USERS.filter((x) => x.id !== u.id);
              state.users.splice(index, 0, u);
            },
            auditAction: `Record Archived — User ${u.name}`,
            module: "User Management",
            status: "Warning",
            detail: u.id,
            successTitle: "User archived",
            successMessage: `${u.name} moved to the Archive.`,
            refresh: renderAdminTabBody,
          });
        },
      });
    };
  });
}
function openUserDetails(user) {
  if (!user || !canManageClinicAccounts()) return;
  const details = [
    ["Full Name", user.name],
    ["Username", user.username],
    ["Role", user.role],
    ["Account Status", user.status],
  ];
  openModal(
    `<div class="modal-head"><h3>User Details</h3><button class="modal-close" onclick="closeModal()" aria-label="Close user details">${ICONS.x}</button></div><div class="modal-body"><table class="record-detail-table"><tbody>${details.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value || "—")}</td></tr>`).join("")}</tbody></table></div><div class="modal-foot"><button class="btn" onclick="closeModal()">Close</button></div>`,
    `sm user-details-modal`,
  );
  logAudit(
    `User Details Viewed — ${user.id}`,
    "User Management",
    "Success",
    false,
    false,
    user.id,
  );
}
function renderAuditTab() {
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(AUDIT_LOGS.length / perPage));
  if (state.auditPage > totalPages) state.auditPage = totalPages;
  const items = AUDIT_LOGS.slice(
    (state.auditPage - 1) * perPage,
    state.auditPage * perPage,
  );
  const rows = items
    .map(
      (l) => `
    <tr>
      <td>${fmtDate(l.date)}</td><td class="mono">${l.time}</td><td>${escapeHtml(l.user)}</td><td>${escapeHtml(l.role || "Unknown")}</td>
      <td>${escapeHtml(l.action)}</td><td>${l.module}</td>
      <td><span class="chip ${l.status === "Success" ? "chip-available" : l.status === "Warning" ? "chip-low" : "chip-out"}">${l.status}</span></td>
    </tr>`,
    )
    .join("");
  return `
  <div class="card">
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th><th>Status</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7">${emptyState("No audit activity recorded yet.")}</td></tr>`}</tbody></table></div>
    <div class="pagination"><span>Page ${state.auditPage} of ${totalPages} · ${AUDIT_LOGS.length} entries</span>
      <div class="page-btns"><button type="button" data-apage="prev" aria-label="Previous audit log page" title="Previous page">${ICONS.chevleft}</button><button type="button" data-apage="next" aria-label="Next audit log page" title="Next page">${ICONS.chevright}</button></div>
    </div>
  </div>`;
}
function bindAuditTab() {
  document.querySelectorAll("[data-apage]").forEach(
    (b) =>
      (b.onclick = () => {
        state.auditPage += b.dataset.apage === "next" ? 1 : -1;
        if (state.auditPage < 1) state.auditPage = 1;
        renderAdminTabBody();
      }),
  );
}
function fmtDeletedDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fmtDate(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
function renderDeletedTab() {
  const canAdminister = canManageClinicAccounts();
  const delStudents = DELETED_STUDENTS || [];
  const delConsults = CONSULTATIONS.filter(
    (c) => c.deleted || c.status === "Deleted",
  );
  const delMeds = MEDICINES.filter((m) => m.deleted || m.deletedAt);
  const delEq = EQUIPMENT.filter((e) => e.deleted || e.deletedAt);
  const delUsers = canAdminister ? (DELETED_USERS || []).filter(user=>!isProtectedSuperAdmin(user)) : [];
  const rowActions = (restoreAttribute, id, restoreAllowed = canDeleteClinicRecords()) =>
    `<div class="row-actions">${restoreAllowed ? `<button class="mini-btn good" data-${restoreAttribute}="${escapeHtml(id)}" title="Restore from Archive">${ICONS.restore}</button>` : ""}</div>`;
  const section = (title, rows, empty) => `
    <div class="card" style="margin-bottom:16px;">
      <div class="panel-title"><h4>${title}</h4></div>
      ${rows.length === 0 ? emptyState(empty) : `<div class="table-wrap"><table>${rows}</table></div>`}
    </div>`;
  const consultRows = delConsults.length
    ? `<thead><tr><th>Record</th><th>Patient</th><th>Date</th><th></th></tr></thead><tbody>${delConsults
        .map(
          (
            c,
          ) => `<tr><td class="mono">${escapeHtml(c.id)}</td><td>${escapeHtml(c.studentName || "Unknown patient")}</td><td>${fmtDate(c.date)}</td>
    <td>${rowActions("restore-dc", c.id)}</td></tr>`,
        )
        .join("")}</tbody>`
    : "";
  const studentRows = delStudents.length
    ? `<thead><tr><th>Name</th><th>Institutional Category / Personnel Type</th><th>Archived</th><th></th></tr></thead><tbody>${delStudents
        .map(
          (
            s,
          ) => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.institutionalCategory || s.course || "—")} · ${escapeHtml(s.personnelType || s.year || "—")}</td><td>${fmtDeletedDate(s.deletedAt)}</td>
    <td>${rowActions("restore-dp", s.id)}</td></tr>`,
        )
        .join("")}</tbody>`
    : "";
  const medRows = delMeds.length
    ? `<thead><tr><th>Code</th><th>Name</th><th>Production Date</th><th>Archived</th><th></th></tr></thead><tbody>${delMeds
        .map(
          (
            m,
          ) => `<tr><td class="mono">${escapeHtml(m.code)}</td><td>${escapeHtml(m.name)}</td><td>${fmtDate(m.productionDate)}</td><td>${fmtDeletedDate(m.deletedAt)}</td>
    <td>${rowActions("restore-dm", m.code)}</td></tr>`,
        )
        .join("")}</tbody>`
    : "";
  const eqRows = delEq.length
    ? `<thead><tr><th>ID</th><th>Name</th><th>Archived</th><th></th></tr></thead><tbody>${delEq
        .map(
          (
            e,
          ) => `<tr><td class="mono">${escapeHtml(e.id)}</td><td>${escapeHtml(e.name)}</td><td>${fmtDeletedDate(e.deletedAt)}</td>
    <td>${rowActions("restore-de", e.id)}</td></tr>`,
        )
        .join("")}</tbody>`
    : "";
  const userRows = delUsers.length
    ? `<thead><tr><th>ID</th><th>Name</th><th>Archived</th><th></th></tr></thead><tbody>${delUsers
        .map(
          (
            u,
          ) => `<tr><td class="mono">${escapeHtml(u.id)}</td><td>${escapeHtml(u.name)}</td><td>${fmtDeletedDate(u.deletedAt)}</td>
    <td>${rowActions("restore-du", u.id, canAdminister)}</td></tr>`,
        )
        .join("")}</tbody>`
    : "";
  return (
    section(
      "Archived Patient Visits",
      consultRows,
      "No archived patient visits.",
    ) +
    section("Archived Patients", studentRows, "No archived patients.") +
    section("Archived Medicines", medRows, "No archived medicines.") +
    section("Archived Medical Supplies and Equipment", eqRows, "No archived medical supplies or equipment.") +
    section("Archived Users", userRows, "No archived users.")
  );
}
async function commitDeletedRecordChange({
  label,
  apply,
  rollback,
  save = () => saveToClinicState(true),
  auditAction,
  auditActions,
  module,
  status = "Success",
  successTitle,
  successMessage,
}) {
  let applied = false;
  try {
    applied = true;
    apply();
    await save();
  } catch (error) {
    if (applied) rollback();
    toast(
      "Change not saved",
      error.message || `Unable to update ${label}.`,
      "err",
    );
    renderAdminTabBody();
    return;
  }
  const events = auditActions || [{ action: auditAction, module, status }];
  try {
    await Promise.all(
      events.map((event) =>
        logAudit(
          event.action,
          event.module || module,
          event.status || status,
          false,
          true,
          event.detail || "",
        ),
      ),
    );
  } catch {
    toast(
      "Record changed; audit sync failed",
      "The record change was saved, but its audit entry could not be recorded.",
      "err",
    );
    renderAdminTabBody();
    return;
  }
  toast(successTitle, successMessage, status === "Warning" ? "warn" : "ok");
  renderAdminTabBody();
}
function bindDeletedTab() {
  document.querySelectorAll("[data-restore-dc]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canDeleteClinicRecords()) return;
        const record = CONSULTATIONS.find(
          (row) => row.id === b.dataset.restoreDc,
        );
        if (!record) return;
        const patient = DELETED_STUDENTS.find(
          (row) => row.id === record.studentId,
        );
        const restoredPatient = patient ? { ...patient, deleted: false } : null;
        if (restoredPatient) {
          delete restoredPatient.deletedAt;
          delete restoredPatient.deletedBy;
        }
        const previous = {
            deleted: record.deleted,
            deletedAt: record.deletedAt,
            status: record.status,
          },
          patientIndex = patient ? DELETED_STUDENTS.indexOf(patient) : -1;
        const inventorySnapshot = captureInventoryState();
        confirmDialog({
          title: "Restore this patient visit?",
          msg: `Visit <b>${escapeHtml(record.id)}</b> will return to Patient Visits${patient ? " and its archived patient will also be restored" : ""}.`,
          okLabel: "Restore Visit",
          danger: false,
          onConfirm: () =>
            commitDeletedRecordChange({
              label: `visit ${record.id}`,
              apply: () => {
                if (patient && STUDENTS.some((row) => row.id === patient.id))
                  throw new Error(
                    "A record with this patient ID is already active.",
                  );
                validateVisitInventoryUsage(record);
                applyVisitInventoryUsage(record);
                if (patient) {
                  DELETED_STUDENTS = DELETED_STUDENTS.filter(
                    (row) => row.id !== patient.id,
                  );
                  STUDENTS.unshift(restoredPatient);
                }
                record.deleted = false;
                delete record.deletedAt;
                if (record.status === "Deleted") record.status = "Active";
              },
              rollback: () => {
                restoreInventoryState(inventorySnapshot);
                Object.assign(record, previous);
                if (patient) {
                  const activeIndex = STUDENTS.findIndex(
                    (row) => row.id === patient.id,
                  );
                  if (activeIndex >= 0) STUDENTS.splice(activeIndex, 1);
                  DELETED_STUDENTS.splice(
                    Math.min(patientIndex, DELETED_STUDENTS.length),
                    0,
                    patient,
                  );
                }
              },
              save: () =>
                saveVisitInventoryStatusToClinicState(
                  record.id,
                  false,
                  Boolean(patient),
                ),
              auditActions: [
                {
                  action: `Record Restored — Patient Visit ${record.id}`,
                  module: "Patient Visits",
                  detail: record.id,
                },
                ...(patient
                  ? [
                      {
                        action: `Record Restored — Patient ${patient.id}`,
                        module: "Patients",
                        detail: patient.id,
                      },
                    ]
                  : []),
                ...clinicInventoryAuditActions(
                  inventorySnapshot,
                  `visit ${record.id} restored`,
                ),
              ],
              module: "Patient Visits",
              successTitle: "Restored",
              successMessage: `Visit ${record.id} restored.`,
            }),
        });
      }),
  );
  document.querySelectorAll("[data-restore-dp]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canDeleteClinicRecords()) return;
        const patient = DELETED_STUDENTS.find(
          (row) => row.id === b.dataset.restoreDp,
        );
        if (!patient) return;
        if (STUDENTS.some((row) => row.id === patient.id)) {
          toast(
            "Patient already exists",
            "A record with this patient ID is already active.",
            "err",
          );
          return;
        }
        const restored = { ...patient, deleted: false };
        delete restored.deletedAt;
        delete restored.deletedBy;
        const deletedIndex = DELETED_STUDENTS.indexOf(patient);
        commitDeletedRecordChange({
          label: `patient ${patient.name}`,
          apply: () => {
            DELETED_STUDENTS = DELETED_STUDENTS.filter(
              (row) => row.id !== patient.id,
            );
            STUDENTS.unshift(restored);
          },
          rollback: () => {
            const activeIndex = STUDENTS.findIndex(
              (row) => row.id === patient.id,
            );
            if (activeIndex >= 0) STUDENTS.splice(activeIndex, 1);
            DELETED_STUDENTS.splice(
              Math.min(deletedIndex, DELETED_STUDENTS.length),
              0,
              patient,
            );
          },
          save: () => saveDeletedRecordRestoreToClinicState("patient", patient.id),
          auditAction: `Record Restored — Patient ${patient.id}`,
          module: "Patients",
          auditActions: [
            {
              action: `Record Restored — Patient ${patient.id}`,
              module: "Patients",
              detail: patient.id,
            },
          ],
          successTitle: "Restored",
          successMessage: `${patient.name} restored.`,
        });
      }),
  );
  document.querySelectorAll("[data-restore-dm]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canDeleteClinicRecords()) return;
        const item = MEDICINES.find((row) => row.code === b.dataset.restoreDm);
        if (!item) return;
        const previous = { deleted: item.deleted, deletedAt: item.deletedAt };
        commitDeletedRecordChange({
          label: `medicine ${item.name}`,
          apply: () => {
            item.deleted = false;
            delete item.deletedAt;
          },
          rollback: () => Object.assign(item, previous),
          save: () =>
            saveInventoryItemStatusToClinicState("medicine", item.code, false),
          auditAction: `Record Restored — ${item.name}`,
          module: "Medicines",
          auditActions: [
            {
              action: `Record Restored — Medicine ${item.name}`,
              module: "Medicines",
              detail: item.code,
            },
          ],
          successTitle: "Restored",
          successMessage: `${item.name} restored.`,
        });
      }),
  );
  document.querySelectorAll("[data-restore-de]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canDeleteClinicRecords()) return;
        const item = EQUIPMENT.find((row) => row.id === b.dataset.restoreDe);
        if (!item) return;
        const previous = { deleted: item.deleted, deletedAt: item.deletedAt };
        commitDeletedRecordChange({
          label: `medical supply ${item.name}`,
          apply: () => {
            item.deleted = false;
            delete item.deletedAt;
          },
          rollback: () => Object.assign(item, previous),
          save: () =>
            saveInventoryItemStatusToClinicState("equipment", item.id, false),
          auditAction: `Record Restored — ${item.name}`,
          module: "Medical Supplies",
          auditActions: [
            {
              action: `Record Restored — Medical Supply ${item.name}`,
              module: "Medical Supplies",
              detail: item.id,
            },
          ],
          successTitle: "Restored",
          successMessage: `${item.name} restored.`,
        });
      }),
  );
  document.querySelectorAll("[data-restore-du]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canManageClinicAccounts()) return;
        const user = DELETED_USERS.find(
          (row) => row.id === b.dataset.restoreDu,
        );
        if (!user) return;
        if (
          state.users.some(
            (row) =>
              row.id === user.id ||
              row.username.toLowerCase() ===
                String(user.username).toLowerCase(),
          )
        ) {
          toast(
            "User already exists",
            "An active account already uses this user ID or username.",
            "err",
          );
          return;
        }
        const restored = { ...user, deleted: false };
        delete restored.deletedAt;
        delete restored.deletedBy;
        commitDeletedRecordChange({
          label: `user ${user.name}`,
          apply: () => {
            DELETED_USERS = DELETED_USERS.filter((row) => row.id !== user.id);
            state.users.unshift(restored);
          },
          rollback: () => {
            state.users = state.users.filter((row) => row.id !== user.id);
            DELETED_USERS.unshift(user);
          },
          save: () => saveDeletedRecordRestoreToClinicState("user", user.id),
          auditAction: `User Restored — ${user.name}`,
          module: "User Management",
          auditActions: [
            {
              action: `User Restored — ${user.name}`,
              module: "User Management",
              detail: user.id,
            },
          ],
          successTitle: "Restored",
          successMessage: `${user.name} restored.`,
        });
      }),
  );
}
function renderAdminTabBody() {
  const body = document.getElementById("admin-body");
  document.getElementById("admin-back-btn")?.addEventListener("click", () => {
    state.page = "settings";
    render();
  });
  if (state.adminTab === "users") {
    body.innerHTML = renderUsersTab();
    if (canManageClinicAccounts()) bindUsersTab();
  } else if (state.adminTab === "audit") {
    body.innerHTML = renderAuditTab();
    bindAuditTab();
  } else {
    try {
      body.innerHTML = renderDeletedTab();
      bindDeletedTab();
    } catch (error) {
      console.error("Unable to render deleted clinic records.", error);
      body.innerHTML = [
        "Patient Visit",
        "Patients",
        "Medicines",
        "Medical Supplies",
        "Users",
      ]
        .map(
          (category) => `
        <div class="card" style="margin-bottom:16px;">
          <div class="panel-title"><h4>Archive ${category}</h4></div>
          ${emptyState("Archived records could not be loaded. Check the clinic sync status and reload this page.")}
        </div>`,
        )
        .join("");
    }
  }
}
