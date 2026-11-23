-- ─────────────────────────────────────────────────────────────
-- Cleanup seed lama Kepmenkes 1128/2022 (74 EP) yang sudah
-- digantikan oleh seed 47104/2024 (Kepmenkes 1596/2024).
--
-- Drop semua mapping form_ep_map dan eviden_folder_ep_map yg
-- tie ke kd_ep 1128/2022 (kd_ep format berbeda, tidak bisa
-- auto-remap). Mapping di-rebuild manual via UI eviden &
-- /akreditasi/ep/* untuk EP 1596/2024.
-- ─────────────────────────────────────────────────────────────

DELETE FROM form_ep_map
 WHERE kd_ep IN (SELECT kd_ep FROM starkes_ep WHERE versi_kepmenkes='1128/2022');

DELETE FROM eviden_folder_ep_map
 WHERE kd_ep IN (SELECT kd_ep FROM starkes_ep WHERE versi_kepmenkes='1128/2022');

DELETE FROM starkes_ep WHERE versi_kepmenkes='1128/2022';
