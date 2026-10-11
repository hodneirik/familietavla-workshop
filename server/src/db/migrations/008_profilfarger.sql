-- Profilfargene begrenses til paletten i designsystemet. Gamle farger flyttes til nærmeste.
UPDATE users SET farge = CASE lower(farge)
  WHEN '#4f8cff' THEN '#889cb0'
  WHEN '#ff7a59' THEN '#cda89a'
  WHEN '#2fb67c' THEN '#82b797'
  WHEN '#a56bff' THEN '#889cb0'
  WHEN '#f2b134' THEN '#e6d8b0'
  WHEN '#e8579a' THEN '#cda89a'
  ELSE lower(farge)
END;
UPDATE users SET farge = '#889cb0'
  WHERE farge NOT IN ('#82b797', '#b4cdb0', '#e6d8b0', '#cda89a', '#889cb0');
