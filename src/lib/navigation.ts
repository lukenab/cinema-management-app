import { router } from "expo-router";

/**
 * Shows a paid ticket on top of the ticket list: the booking screens (seats, food, payment) are removed
 * from the stack so "back" from the ticket never lands on a finished order.
 */
export function openPaidTicket(bookingId: string) {
  router.dismissTo("/tickets");
  router.push(`/booking/${bookingId}/ticket`);
}
