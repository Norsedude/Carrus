-- Adds the Sports and Luxury vehicle types used by the design mockup.
alter table public.vehicles drop constraint vehicles_vehicle_type_check;
alter table public.vehicles add constraint vehicles_vehicle_type_check
  check (vehicle_type in ('Sedan', 'SUV', 'Sports', 'Luxury', 'Minivan', 'Van', 'Truck'));
