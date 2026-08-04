'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema, BookingFormValues } from '@/schemas/booking.schema';
import { useBookingDraftStore } from '@/store/booking-draft.store';
import { useSeatSelectionStore } from '@/store/seat-selection.store';
import { useFareQuote } from '@/hooks/api/useFareQuote';
import { useCreateBookingHold } from '@/hooks/api/useCreateBookingHold';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { FareBreakdown } from './FareBreakdown';
import { Card } from '@/components/ui/Card';
import { getUserError } from '@/utils/user-error';
export function BookingPageView() {
  const router = useRouter(),
    online = useNetworkStatus(),
    draft = useBookingDraftStore(),
    resetSeats = useSeatSelectionStore((s) => s.reset),
    hold = useCreateBookingHold(),
    idempotency = useIdempotencyKey();
  const seats = draft.selectedSeatIds || [];
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      passengers: seats.map((id, index) => ({
        passengerNumber: index + 1,
        fullName: '',
        passengerType: 'ADULT' as const,
        identityType: 'NIC' as const,
        identityNumber: '',
        identityCountry: 'LKA',
        dateOfBirth: '',
        journeySeatId: id,
      })),
      contact: { fullName: '', email: '', phone: '' },
      policyAccepted: false as true,
    },
  });
  const fields = useFieldArray({ control: form.control, name: 'passengers' });
  const watchedPassengers = form.watch('passengers');
  const types = watchedPassengers.map((p) => ({ passengerType: p.passengerType }));
  const fareInput =
    draft.journeyId &&
    draft.originJourneyStationId &&
    draft.destinationJourneyStationId &&
    types.length
      ? {
          journeyId: draft.journeyId,
          originJourneyStationId: draft.originJourneyStationId,
          destinationJourneyStationId: draft.destinationJourneyStationId,
          journeySeatId: seats[0],
          passengers: types,
        }
      : null;
  const fare = useFareQuote(fareInput);
  if (
    !draft.journeyId ||
    !draft.originJourneyStationId ||
    !draft.destinationJourneyStationId ||
    !seats.length
  )
    return <Recovery />;
  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await hold.mutateAsync({
        key: idempotency.key,
        input: {
          journeyId: draft.journeyId,
          originJourneyStationId: draft.originJourneyStationId,
          destinationJourneyStationId: draft.destinationJourneyStationId,
          passengers: values.passengers,
          contact: values.contact,
        },
      });
      resetSeats();
      router.push(`/booking/${result.bookingId}/payment`);
    } catch (error) {
      if ((error as any)?.code === 'SEAT_UNAVAILABLE')
        router.push(
          `/journey/${draft.journeyId}/seats?originJourneyStationId=${draft.originJourneyStationId}&destinationJourneyStationId=${draft.destinationJourneyStationId}&passengerCount=${seats.length}`,
        );
    }
  });
  return (
    <div className="shell">
      <div className="page-heading">
        <h1>Passenger and booking details</h1>
      </div>
      <form className="booking-layout" onSubmit={submit}>
        <div className="stack">
          {fields.fields.map((field, index) => (
            <Card key={field.id}>
              <h2>Passenger {index + 1}</h2>
              <div className="grid-2">
                <div className="field">
                  <label>Full name</label>
                  <input className="input" {...form.register(`passengers.${index}.fullName`)} />
                  <ErrorText value={form.formState.errors.passengers?.[index]?.fullName?.message} />
                </div>
                <div className="field">
                  <label>Passenger type</label>
                  <select className="input" {...form.register(`passengers.${index}.passengerType`)}>
                    <option value="ADULT">Adult</option>
                    <option value="CHILD">Child</option>
                    <option value="SENIOR">Senior</option>
                    <option value="STUDENT">Student</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
                <div className="field">
                  <label>Identity type</label>
                  <select className="input" {...form.register(`passengers.${index}.identityType`)}>
                    <option value="NIC">Sri Lankan NIC</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DEPENDENT">Dependent (no own ID)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Date of birth</label>
                  <input
                    className="input"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    {...form.register(`passengers.${index}.dateOfBirth`)}
                  />
                  <ErrorText
                    value={form.formState.errors.passengers?.[index]?.dateOfBirth?.message}
                  />
                </div>
                {watchedPassengers[index]?.identityType !== 'DEPENDENT' ? (
                  <>
                    <div className="field">
                      <label>
                        {watchedPassengers[index]?.identityType === 'PASSPORT'
                          ? 'Passport number'
                          : 'NIC number'}
                      </label>
                      <input
                        className="input"
                        autoComplete="off"
                        {...form.register(`passengers.${index}.identityNumber`)}
                      />
                      <ErrorText
                        value={form.formState.errors.passengers?.[index]?.identityNumber?.message}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label>Responsible guardian</label>
                      <select
                        className="input"
                        {...form.register(`passengers.${index}.guardianPassengerNumber`, {
                          valueAsNumber: true,
                        })}
                      >
                        <option value="">Select guardian</option>
                        {watchedPassengers.map((passenger, guardianIndex) =>
                          guardianIndex !== index && passenger.identityType !== 'DEPENDENT' ? (
                            <option key={guardianIndex} value={guardianIndex + 1}>
                              Passenger {guardianIndex + 1}: {passenger.fullName || 'Unnamed'}
                            </option>
                          ) : null,
                        )}
                      </select>
                      <ErrorText
                        value={
                          form.formState.errors.passengers?.[index]?.guardianPassengerNumber
                            ?.message
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Relationship</label>
                      <input
                        className="input"
                        placeholder="Child, ward…"
                        {...form.register(`passengers.${index}.guardianRelationship`)}
                      />
                    </div>
                  </>
                )}
              </div>
              <input
                type="hidden"
                {...form.register(`passengers.${index}.passengerNumber`, { valueAsNumber: true })}
              />
              <input type="hidden" {...form.register(`passengers.${index}.journeySeatId`)} />
            </Card>
          ))}
          <Card>
            <h2>Contact details</h2>
            <div className="grid-2">
              <div className="field">
                <label>Contact name</label>
                <input className="input" {...form.register('contact.fullName')} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" {...form.register('contact.email')} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input className="input" type="tel" {...form.register('contact.phone')} />
              </div>
            </div>
          </Card>
        </div>
        <aside className="stack">
          <Card>
            <h2>Selected seats</h2>
            <div className="seat-chips">
              {seats.map((id) => (
                <span className="badge" key={id}>
                  {id.slice(0, 8)}
                </span>
              ))}
            </div>
          </Card>
          <Card>
            <FareBreakdown fare={fare.data} />
          </Card>
          <Card>
            <label className="check">
              <input type="checkbox" {...form.register('policyAccepted')} /> I accept the booking
              and cancellation policy.
            </label>
            <ErrorText value={form.formState.errors.policyAccepted?.message} />
            {hold.error && (
              <div className="form-alert" role="alert">
                {getUserError(hold.error)}
              </div>
            )}
            <button className="button" disabled={!online || hold.isPending}>
              {hold.isPending ? 'Creating secure hold…' : 'Create booking hold'}
            </button>
          </Card>
        </aside>
      </form>
    </div>
  );
}
function ErrorText({ value }: { value?: string }) {
  return value ? <span className="field-error">{value}</span> : null;
}
function Recovery() {
  return (
    <div className="shell center">
      <h1>Your booking draft is incomplete</h1>
      <p className="muted">Select a journey and seats before entering passenger details.</p>
      <Link className="button" href="/find-trains">
        Find a journey
      </Link>
    </div>
  );
}
