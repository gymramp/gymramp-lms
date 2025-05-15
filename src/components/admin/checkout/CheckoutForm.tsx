
*   This will be a client component (`'use client'`).
*   **Fields:**
    *   Customer Name (Text Input)
    *   Company Name (Text Input)
    *   Billing Address (Placeholder fields for now - Street, City, State, Zip, Country)
    *   New Admin Email (Email Input)
    *   Course Selection (Multi-select Checkbox group or similar UI):
        *   Fetch all courses using `getAllCourses` from `src/lib/courses-data.ts`.
        *   Display available courses with their names and prices.
        *   Allow Super Admin to select multiple courses.
    *   Selected Courses Display: Show a list of the chosen courses and their individual prices.
    *   Total Amount Display: Dynamically calculate and display the sum of the prices of selected courses.
    *   Payment Information Section: Add placeholder UI elements where Stripe Elements will eventually be integrated for secure card input.
*   **State Management:** Use `useState` to manage form inputs, selected courses, and the calculated total.
*   **Submission Logic:** Handle form submission, calling a Server Action to process the checkout.
