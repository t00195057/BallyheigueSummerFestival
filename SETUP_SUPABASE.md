# Trimmers Hair Salon Planner Online Save Setup

Use these steps to make the planner save online and stay shared across phones.

1. Open the Supabase dashboard for the project already used by this website:
   [https://supabase.com/dashboard/project/dkvoxbqxwxcfgmtfrrme](https://supabase.com/dashboard/project/dkvoxbqxwxcfgmtfrrme)

2. Open the SQL editor in Supabase.

3. Create a new query.

4. Paste in the full contents of [sql/012_salon_planner_state.sql](C:\Users\jpjoh\Videos\SUILOID\Siuloid Docs\Website\sql\012_salon_planner_state.sql).

5. Run the SQL.

6. In Supabase, open `Authentication` and then `Users`.

7. Create one user for the salon.
   Example email: `trimmerssalon@example.com`
   Example rule: use one shared salon email and password on every phone.

8. Publish the updated website to GitHub so the new app files go live.

9. Open [salon-scheduler.html](C:\Users\jpjoh\Videos\SUILOID\Siuloid Docs\Website\salon-scheduler.html) on the first phone.

10. Tap the top-left menu.

11. Tap `Salon login`.

12. Sign in with the salon email and password you made in Supabase.

13. Repeat the same `Salon login` step on every other phone that should share the planner.

14. Test it:
    Add a customer or appointment on one phone.
    Open the planner on the second phone.
    Tap `Sync now` if needed.

If Supabase says the table does not exist, it means the SQL from step 4 was not run yet.
