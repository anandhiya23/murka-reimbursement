-- Deactivate all projects NOT in the active list
update projects set is_active = false
where name not in (
  'Daily Operation',
  'Slola',
  'Glico Wings',
  'ApoTech+',
  'Pilkita',
  'Light+',
  'Pizza Hut',
  'Hampers Lebaran',
  'Bear Brand',
  'Bukber Trisakti',
  'Usaha Bareng AdaKami',
  'Wirasena Website'
);

-- Ensure the listed ones are active
update projects set is_active = true
where name in (
  'Daily Operation',
  'Slola',
  'Glico Wings',
  'ApoTech+',
  'Pilkita',
  'Light+',
  'Pizza Hut',
  'Hampers Lebaran',
  'Bear Brand',
  'Bukber Trisakti',
  'Usaha Bareng AdaKami',
  'Wirasena Website'
);
