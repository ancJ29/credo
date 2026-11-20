---
source: docs/products.md
---

# What credo has today

This page is for partners who show credo to others or check it, and who do not read code. After it you know what already works, what is missing, and how to check one piece yourself.

## What works today

Credo is a system a company uses to take orders and deliver them, on a phone, a tablet or a computer, in Vietnamese or English. Each person sees only the pages their permissions allow, so you can show one role at a time.

These parts are built:

- **Sign-in.** Staff sign in by code, email or QR code.
- **Staff and setup.** The company's main user keeps the people and imports them from an Excel file, which saves typing a long list.
- **Customers and products.** The main user loads each list from an Excel file and sees every row checked before it is added.
- **Orders.** Office staff make a priced order and confirm it with a driver and a day.
- **Deliveries.** A driver opens the day's requests on a phone, calls the customer, and sends "Delivered" with a photo. The office sees the photo, or reads that it did not arrive.
- **Settling a driver's day.** The office compares a driver's day with the cash handed in and sees the gap. The day closes once, so no one overwrites it.

A second area is for the people who run credo. An operator adds a client and copies its sign-in link, or moves a company to another machine. Deleting a company cannot be undone, so it asks for the company's code first.

## What is not built yet

- Nothing runs in production, which means no client has a live system of their own yet. Ask us before you promise a client a start date.
- Stock beyond a simple in-stock switch is not built.
- The menu entries "Usage and costs" and "Activity" open an empty "coming soon" page.
- Changes are recorded behind the scenes, but no screen shows the record yet.

## Check a piece yourself, without code

Credo has a shared test copy, called "ridge": one machine where people who do not code check a piece before anyone relies on it. Each piece has a card: what to open, at most six steps, what you should see, and one question.

- **Who can check:** anyone holding a demo copy's link and password. A demo copy is an invented company. Each partner has a copy of their own, and we have one too. We send you the link and password by our own channel.
- **What your answer starts:** a yes means the piece has passed its last stage, and we list it as live on ridge. A no, with the step that failed, reopens the piece.
- **Your card makes its own records,** so old demo data cannot spoil it.

### Example: the delivery photo

You need a computer and a phone. Open your demo copy on the computer and sign in as its main user.

1. Under Orders, press "New order". Choose a customer and a product, set the quantity, press "Add line", then "Save draft".
2. Press "Confirm the order", choose a driver and press "Confirm". A delivery request is made.
3. Under Staff, open that driver and press "Show a QR code".
4. Scan the code with the phone. It opens "My deliveries" as the driver. Open today's request, press "Delivered", take a photo and press "Send".
5. On the computer, under Delivery requests, open that delivery.

You should see your own picture under "Proof of delivery", not the words "The photo did not arrive."

**The question:** did your photo show on the office's page? Answer yes or no, and with a no, the number of the failed step.
