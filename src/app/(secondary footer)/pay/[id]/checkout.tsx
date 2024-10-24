"use client";

import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { contact_step, eventSchema, ticket_types_step } from "@/lib/zod";
import {
  cn,
  calculateDiscountedPrice,
  calculateSubtotal,
  calculateTotal,
} from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useRouter } from "next/navigation";
import { createTicket } from "../../../../../actions/tickets";
import { useCountDown } from "@/hooks/use-countdown";
import { PhoneInput } from "@/components/ui/phone-number";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function Checkout(props: z.infer<typeof eventSchema>) {
  const [timeLeft, { start, format, reset, pause, resume }] = useCountDown(
    60 * 1000 * 10
  );

  const router = useRouter();
  const [preview] = useAutoAnimate<HTMLDivElement>();
  const [container] = useAutoAnimate<HTMLDivElement>();
  const [pending, setPending] = React.useState(false);
  const [sendToSame, setSendToSame] = React.useState<string>("no"); // "yes" |"no"

  const step1Ref = React.useRef<HTMLButtonElement>(null);
  const step2Ref = React.useRef<HTMLButtonElement>(null);

  const [step, setStep] = React.useState<"ticket_types" | "contact" | "method">(
    "ticket_types"
  );

  React.useEffect(() => {
    if (timeLeft <= 0 && !pending && step === "contact") {
      step2.reset();
      pause();
      reset();
      setStep("ticket_types");
    }

    // return () => {
    //   pause();
    //   reset();
    // };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const step1 = useForm<z.infer<typeof ticket_types_step>>({
    resolver: zodResolver(ticket_types_step),
    defaultValues: {
      tickets: [...props.ticket_type.map((t) => ({ ...t, quantity: 0 }))],
    },
  });

  const tickets = step1.watch("tickets");

  const ticketsGreaterThanOne =
    tickets.flatMap((ticket) =>
      Array(ticket.quantity).fill({
        ticket_type: ticket.name,
      })
    )?.length === 1;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function onSubmitStep1(_values: z.infer<typeof ticket_types_step>) {
    setPending(true);
    start();
    const expandedTickets = _values.tickets.flatMap((ticket) =>
      Array(ticket.quantity).fill({
        ticket_type: ticket.name,
        first_name: "",
        last_name: "",
        gender: "",
        email: "",
        confirmemail: "",
        phone_number: "",
        questions: [],
      })
    );
    step2.setValue("attendees", expandedTickets);
    setStep("contact");
    setPending(false);
  }

  const step2 = useForm<z.infer<typeof contact_step>>({
    resolver: zodResolver(contact_step),
    defaultValues: {
      contact: {
        first_name: "",
        last_name: "",
        gender: "",
        email: "",
        confirmemail: "",
        phone_number: "",
      },
      attendees: [],
    },
  });

  const attendees = step2.watch("attendees");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function onSubmitStep2(values: z.infer<typeof contact_step>) {
    setPending(true);
    pause();

    // if (props.event_type !== "Free") {
    //   // setStep("method");
    //   toast.warning("Oops feature unavailable", {
    //     description:
    //       "Sorry for the inconvenience, but this feature is not available on the current event type at the moment!",
    //     closeButton: true,
    //   });
    //   return;
    // }

    try {
      const res = await createTicket(
        {
          contact: values.contact,
          attendees: values.attendees,
          tickets: tickets,
          payment_method: "Free",
        },
        props
      );

      if (res?.status === true && res?.data) {
        if (res?.data?.paystack) {
          toast.success("Congrats 🎉", {
            description:
              "Your ticket reservation was successful, you will be redirected to a secure payment channel to pay.",
            closeButton: true,
          });
          setTimeout(
            () =>
              router.push(
                res?.data?.paystack ?? "/pay/success?id=${res.data.ticket._id}"
              ),
            3000
          );
        } else {
          toast.success("Congrats 🎉", {
            description: "Your ticket reservation was successful",
            closeButton: true,
          });
          router.push(`/pay/success?id=${res.data.ticket._id}`);
        }
      } else {
        toast.warning("Oops", {
          description:
            res?.message ??
            "Something went wrong, couldn't reserve your ticket. Please try again",
          closeButton: true,
        });
      }
    } catch (e) {
      console.error(e);
      toast.warning("Oops", {
        description:
          "Something went wrong, couldn't reserve your ticket. Please try again",
        closeButton: true,
      });
    } finally {
      resume();
      setPending(false);
    }
  }

  function onSubmit() {
    if (step === "ticket_types") {
      if (tickets.filter((t) => t.quantity >= 1)?.length >= 1)
        step1Ref?.current?.click();
      else
        toast.warning("Oops", {
          description:
            "At least one ticket must have a quantity of at least 1.",
          closeButton: true,
        });
    } else if (step === "contact") {
      step2Ref?.current?.click();
    }
  }

  step2.watch(({ contact, attendees }, { name }) => {
    if (
      sendToSame === "yes" &&
      ticketsGreaterThanOne &&
      name?.includes("contact")
    ) {
      step2.setValue("attendees.0", {
        ticket_type: tickets.filter((t) => t.quantity >= 1)[0]?.name,
        first_name: "",
        last_name: "",
        gender: "",
        email: "",
        confirmemail: "",
        phone_number: "",
        ...contact,
        questions: (
          (attendees &&
            attendees[0]?.questions?.filter((q) => q && q.title && q.answer)) ??
          []
        ).map((q) => ({
          title: q?.title ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          answer: undefined as unknown as any,
        })),
      });
    }
  });

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList className='text-xl lg:text-2xl font-medium'>
          <BreadcrumbItem
            className={cn(
              "cursor-pointer select-none transition ease-linear duration-100",
              "text-[hsla(252,_5%,_18%,_1)]",
              step === "ticket_types" && "font-bold text-primary leading-none"
            )}
            onClick={() => {
              setStep("ticket_types");
            }}
          >
            Tickets
          </BreadcrumbItem>
          <BreadcrumbSeparator className='[&>svg]:size-5 [&>svg]:stroke-[3] text-[hsla(218,_15%,_59%,_1)]' />
          <BreadcrumbItem
            className={cn(
              "cursor-pointer select-none transition ease-linear duration-100",
              "text-[hsla(252,_5%,_18%,_1)]",
              step === "contact" && "font-bold text-primary leading-none"
            )}
            onClick={() => {
              console.log(step1.formState.isValid);
              if (step1.formState.isValid) {
                setStep("contact");
              }
            }}
          >
            Contact
          </BreadcrumbItem>
          {props.event_type === "Paid" && (
            <>
              <BreadcrumbSeparator className='[&>svg]:size-5 [&>svg]:stroke-[3] text-[hsla(218,_15%,_59%,_1)]' />
              <BreadcrumbItem
                className={cn(
                  "cursor-pointer select-none transition ease-linear duration-100",
                  "text-[hsla(252,_5%,_18%,_1)]",
                  step === "method" && "font-bold text-primary leading-none"
                )}
                onClick={() => {
                  if (step1.formState.isValid && step2.formState.isValid) {
                    setStep("method");
                  }
                }}
              >
                Payment
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div ref={container} className='grid lg:grid-cols-5 gap-8'>
        {step === "ticket_types" && (
          <Form {...step1}>
            <form
              onSubmit={step1.handleSubmit(onSubmitStep1)}
              className='lg:col-span-2 space-y-4 lg:space-y-6 xl:space-y-8 2xl:space-y-12'
            >
              <div>
                <h3 className='text-2xl lg:text-3xl xl:text-4xl 2xl:text-[44px] text-dark-blue font-bold'>
                  Choose tickets
                </h3>
              </div>
              <FormField
                control={step1.control}
                name='tickets'
                render={({ field }) => (
                  <FormItem className='font-medium space-y-10'>
                    <FormControl>
                      <>
                        {field.value.map((t, index) => (
                          <React.Fragment key={index}>
                            <div className='space-y-5'>
                              <div className='flex items-center justify-between gap-4'>
                                <p>{t.name}</p>
                                {t.cost && t.cost > 0 ? (
                                  t.discount_percent &&
                                  t.discount_percent > 0 ? (
                                    <div className='flex space-x-2 items-end'>
                                      <p className='line-through'>
                                        ₦{t.cost.toLocaleString()}
                                      </p>
                                      <p className='text-primary text-xl'>
                                        ₦
                                        {calculateDiscountedPrice(
                                          t.cost,
                                          t.discount_percent
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  ) : (
                                    <p>₦{t.cost.toLocaleString()}</p>
                                  )
                                ) : (
                                  <p className='text-primary'>Free</p>
                                )}
                              </div>
                              <div className='flex items-center justify-between gap-4 text-[hsla(236,_9%,_66%,_1)]'>
                                <p>
                                  includes ₦
                                  {props.event_type === "Paid"
                                    ? (0.05 * t.cost + 100).toLocaleString()
                                    : "0"}{" "}
                                  fee
                                </p>
                                <p className='capitalize'>{t.discount_name}</p>
                              </div>

                              {t.available_tickets >= 1 ? (
                                <FormControl>
                                  <NumberField
                                    className='w-40'
                                    disabled={t.available_tickets === 0}
                                    value={field.value[index].quantity}
                                    onChange={(value: number) => {
                                      field.onChange(
                                        field.value.map((v, i) =>
                                          i === index
                                            ? { ...v, quantity: value }
                                            : v
                                        )
                                      );
                                    }}
                                    max={props.event_type === "Free" ? 1 : 3}
                                  >
                                    <NumberFieldDecrement />
                                    <NumberFieldInput placeholder='' />
                                    <NumberFieldIncrement
                                      onClick={() => {
                                        const prev =
                                          field.value[index].quantity;
                                        const limit =
                                          props.event_type === "Free" ? 1 : 3;

                                        if (prev === limit) {
                                          toast.warning(
                                            `Maximum limit reached`,
                                            {
                                              description: `You can only select up to ${limit} ${
                                                props.event_type === "Free"
                                                  ? "free"
                                                  : "paid"
                                              } ticket type.`,
                                              closeButton: true,
                                            }
                                          );
                                        }
                                      }}
                                    />
                                  </NumberField>
                                </FormControl>
                              ) : (
                                <p className='text-primary text-sm'>
                                  Out of stock
                                </p>
                              )}

                              <div className='space-y-1.5 text-sm'>
                                {t.info && (
                                  <p className='opacity-80'>{t.info}</p>
                                )}

                                {t.benefits && (
                                  <Collapsible className='space-y-2'>
                                    <CollapsibleContent className='opacity-80'>
                                      <span className='font-bold'>
                                        Benefits:
                                      </span>{" "}
                                      {t.benefits}
                                    </CollapsibleContent>
                                    <CollapsibleTrigger className='py-1 text-primary'>
                                      See more
                                    </CollapsibleTrigger>
                                  </Collapsible>
                                )}
                              </div>
                            </div>
                            {index + 1 !== tickets.length && <Separator />}
                          </React.Fragment>
                        ))}
                      </>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button ref={step1Ref} type='submit' className='hidden' />
            </form>
          </Form>
        )}

        {step === "contact" && (
          <Form {...step2}>
            <form
              onSubmit={step2.handleSubmit(onSubmitStep2)}
              className='lg:col-span-2 space-y-12'
            >
              <div>
                <h3 className='text-[44px] text-dark-blue font-bold'>
                  Contact Information
                </h3>
              </div>

              <div className='space-y-5'>
                <div className='bg-primary/20 border border-primary py-6 px-4 rounded-md'>
                  <p className=''>
                    We&apos;ve reserved your ticket. Please complete checkout
                    within{" "}
                    <span className='font-bold text-primary'>{format}</span> to
                    secure your tickets.
                  </p>
                </div>
                <div className='space-y-3'>
                  <FormField
                    control={step2.control}
                    name='contact.first_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className='text-primary'>*</span>First name
                        </FormLabel>
                        <FormControl>
                          <Input placeholder='Esther' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step2.control}
                    name='contact.last_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className='text-primary'>*</span>Last name
                        </FormLabel>
                        <FormControl>
                          <Input placeholder='Ekpo' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step2.control}
                    name='contact.gender'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className='text-primary'>*</span>Gender
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Your Gender' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='male'>Male</SelectItem>
                            <SelectItem value='female'>Female</SelectItem>
                            {/* <SelectItem value='Non Binary'>
                              Non Binary
                            </SelectItem>
                            <SelectItem value='Rather not say'>
                              Rather not say
                            </SelectItem> */}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step2.control}
                    name='contact.email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className='text-primary'>*</span>Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='esther.ekpo@mail.com'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step2.control}
                    name='contact.confirmemail'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className='text-primary'>*</span>Confirm email
                          address
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='esther.ekpo@mail.com'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step2.control}
                    name='contact.phone_number'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className='text-primary'>*</span>Phone
                        </FormLabel>
                        <FormControl>
                          <PhoneInput
                            international={false}
                            placeholder='2340000000000'
                            defaultCountry='NG'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className='space-y-12 py-6'>
                <div className='space-y-6'>
                  <h3 className='text-2xl font-bold'>
                    {ticketsGreaterThanOne
                      ? "Send ticket to a different email address?"
                      : "Send tickets to email addresses"}
                  </h3>

                  <div className='space-y-4'>
                    <div className='border border-[#2C2B30] p-3 px-4 rounded-lg flex space-x-3'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'
                        className='size-6'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z'
                        />
                      </svg>

                      <p>
                        Tickets will only be sent to the email address you
                        provide here.
                      </p>
                    </div>

                    {ticketsGreaterThanOne && (
                      <RadioGroup
                        value={sendToSame}
                        onValueChange={(value) => {
                          setSendToSame(value);
                          if (value === "yes") {
                            const contact = step2.getValues().contact;
                            const attendees = step2.getValues().attendees[0];
                            step2.setValue("attendees.0", {
                              ...contact,
                              questions: attendees?.questions ?? [],
                              ticket_type: tickets.filter(
                                (t) => t.quantity >= 1
                              )[0]?.name,
                            });
                          }
                        }}
                        className='flex'
                      >
                        {/* Yes is no and no is yes */}
                        <div className='flex items-center space-x-2'>
                          <RadioGroupItem value='no' id='option-two' />
                          <Label htmlFor='option-two'>Yes</Label>
                        </div>
                        <div className='flex items-center space-x-2'>
                          <RadioGroupItem value='yes' id='option-one' />
                          <Label htmlFor='option-one'>No</Label>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                </div>

                <div className='space-y-5'>
                  {attendees.map((attendees, i) => (
                    <div key={i} className='space-y-3'>
                      <h3 className='text-2xl font-bold'>
                        Ticket {i + 1} - {attendees.ticket_type}
                      </h3>
                      {sendToSame === "no" && (
                        <>
                          <FormField
                            control={step2.control}
                            name={`attendees.${i}.first_name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <span className='text-primary'>*</span>First
                                  name
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder='Esther' {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={step2.control}
                            name={`attendees.${i}.last_name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <span className='text-primary'>*</span>Last
                                  name
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder='Ekpo' {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={step2.control}
                            name={`attendees.${i}.gender`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <span className='text-primary'>*</span>
                                  Gender
                                </FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder='Your Gender' />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value='male'>Male</SelectItem>
                                    <SelectItem value='female'>
                                      Female
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={step2.control}
                            name={`attendees.${i}.email`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <span className='text-primary'>*</span>Email
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='esther.ekpo@mail.com'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={step2.control}
                            name={`attendees.${i}.confirmemail`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <span className='text-primary'>*</span>
                                  Confirm email address
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='esther.ekpo@mail.com'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={step2.control}
                            name={`attendees.${i}.phone_number`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <span className='text-primary'>*</span>Phone
                                </FormLabel>
                                <FormControl>
                                  <PhoneInput
                                    international={false}
                                    placeholder='2340000000000'
                                    defaultCountry='NG'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      {props.questions.map((question, k) => {
                        if (question.field === "selectField") {
                          return (
                            <FormField
                              key={k}
                              control={step2.control}
                              name={`attendees.${i}.questions.${k}`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {question.required && (
                                      <span className='text-primary'>*</span>
                                    )}
                                    {question.title}
                                  </FormLabel>
                                  <Select
                                    required={question.required}
                                    onValueChange={(value) => {
                                      field.onChange({
                                        answer: value,
                                        title: question.title,
                                      });

                                      console.log(step2.formState.errors);
                                      console.log(step2.getValues());
                                    }}
                                    defaultValue={field?.value?.answer ?? ""}
                                    // defaultValue={
                                    //   field?.value?.answer &&
                                    //   typeof field.value.answer === "string"
                                    //     ? field.value.answer
                                    //     : undefined
                                    // }
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder='Select' />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {question.options.map((option, i) => (
                                        <SelectItem
                                          key={i}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          );
                        }
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <button ref={step2Ref} type='submit' className='hidden' />
            </form>
          </Form>
        )}

        <div className='lg:col-start-4 lg:col-span-2'>
          <div
            ref={preview}
            className='w-full lg:max-w-96 xl:max-w-md mx-auto bg-white border border-border rounded-lg p-8 space-y-6'
          >
            <h3 className='text-2xl font-bold'>{props.title}</h3>

            {/* the tickets selected here */}
            {tickets
              .filter((t) => t.quantity >= 1)
              .map((t, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between gap-4'
                >
                  <p>
                    {t.quantity}x {t.name}
                  </p>

                  {t.cost && t.cost > 0 ? (
                    t.discount_percent && t.discount_percent > 0 ? (
                      <p>
                        ₦
                        {(
                          calculateDiscountedPrice(t.cost, t.discount_percent) *
                          t.quantity
                        )?.toLocaleString()}
                      </p>
                    ) : (
                      <p>{(t.cost * t.quantity)?.toLocaleString()}</p>
                    )
                  ) : (
                    <p className='text-primary'>Free</p>
                  )}
                </div>
              ))}

            {/* fees */}
            <div className='flex items-center justify-between gap-4'>
              <p>Fees</p>
              <p>
                ₦
                {props.event_type === "Free"
                  ? "0.00"
                  : calculateSubtotal(
                      tickets,
                      props.event_type
                    )?.fees?.toLocaleString()}
              </p>
            </div>

            <div className='flex items-center justify-between gap-4'>
              <p>Subtotal</p>
              {calculateSubtotal(tickets, props.event_type)?.subtotal === 0 ? (
                <p className='text-primary'>Free</p>
              ) : (
                <p>
                  ₦
                  {calculateSubtotal(
                    tickets,
                    props.event_type
                  )?.subtotal?.toLocaleString()}
                </p>
              )}
            </div>

            <div className='flex items-center justify-between gap-4'>
              <p>Coupon Applied</p>
              <p>₦0.00</p>
            </div>

            <Separator />

            <div className='flex items-center justify-between gap-4'>
              <p className='uppercase'>Total</p>
              {calculateTotal(tickets, props.event_type) === 0 ? (
                <p className='font-bold'>Free</p>
              ) : (
                <p className='font-bold'>
                  ₦{calculateTotal(tickets, props.event_type)?.toLocaleString()}
                </p>
              )}
            </div>

            <Button
              className='w-full space-x-3'
              onClick={onSubmit}
              disabled={pending}
            >
              <span> Continue</span>
              {pending && (
                <div role='status'>
                  <svg
                    aria-hidden='true'
                    className='inline size-4 text-white/50 animate-spin fill-white'
                    viewBox='0 0 100 101'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <path
                      d='M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z'
                      fill='currentColor'
                    />
                    <path
                      d='M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z'
                      fill='currentFill'
                    />
                  </svg>
                  <span className='sr-only'>Loading...</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
