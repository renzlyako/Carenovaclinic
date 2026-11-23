export const STATUS_TONE = { scheduled: "blue", completed: "green", cancelled: "red", no_show: "yellow" };
export const STATUS_LABEL = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No show" };

export const patientLabel = (p) => (p ? `${p.last_name}, ${p.first_name} (${p.patient_no})` : "-");
export const doctorLabel = (d) =>
  d ? `${d.profiles?.full_name ?? "Unknown"}${d.specialization ? ` (${d.specialization})` : ""}` : "-";
