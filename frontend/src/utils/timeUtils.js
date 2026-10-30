export const formatTo12Hour = (timeVal) => {
  if (timeVal === undefined || timeVal === null || timeVal === '') return 'N/A';
  let hours = 0;
  let minutes = 0;

  if (typeof timeVal === 'number' && !isNaN(timeVal)) {
    if (timeVal <= 24) {
      hours = timeVal;
      minutes = 0;
    } else {
      hours = Math.floor(timeVal / 60) % 24;
      minutes = timeVal % 60;
    }
  } else if (typeof timeVal === 'string') {
    const trimmed = timeVal.trim();
    if (/am|pm/i.test(trimmed)) return trimmed;

    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10) || 0;
    } else {
      hours = parseInt(trimmed, 10);
      minutes = 0;
    }
  }

  if (isNaN(hours)) return String(timeVal);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
};