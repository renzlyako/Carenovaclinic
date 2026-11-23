export function friendlyDbError(error, fallback = "Something went wrong. Please try again.") {
  switch (error?.code) {
    case "23505":
      return "A record with the same unique value already exists.";
    case "23001": 
    case "23503":
      return "This record is linked to other records (such as appointments or invoices), so it cannot be deleted.";
    case "23514":
      return "One of the values is not allowed by the database rules. Please check your input.";
    case "23502":
      return "A required value is missing.";
    case "42501":
      return "You do not have permission to do this.";
    default:
      return fallback;
  }
}


export function businessRuleMessage(error, fallback) {
  if (error?.code === "P0001" && error.message) return error.message;
  return friendlyDbError(error, fallback);
}
