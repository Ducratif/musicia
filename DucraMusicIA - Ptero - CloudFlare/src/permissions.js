function hasAllowedRole(member, allowedRoleId) {
  if (!member) return false;
  return member.roles?.cache?.has(allowedRoleId) ?? false;
}

module.exports = { hasAllowedRole };
