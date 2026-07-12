#!/usr/bin/env bash
# Create themed production Cognito users. Password pattern: {Theme}.person1
set -euo pipefail

POOL="us-west-1_EO6eJ4U6p"
ORG="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
PROFILE="amplify-admin"
REGION="us-west-1"

password_for_email() {
  local email="$1"
  local localpart="${email%@*}"
  local theme="${localpart##*.}"
  # i.ostolaza87 -> use ostolaza87; nabi.apricot -> apricot
  if [[ "$localpart" == i.* ]]; then theme="Ostolaza"; fi
  local first_char="${theme:0:1}"
  local rest="${theme:1}"
  first_char="$(echo "$first_char" | tr '[:lower:]' '[:upper:]')"
  echo "${first_char}${rest}.person1"
}

create_user() {
  local email="$1" first="$2" last="$3" group="$4"
  local pass
  pass="$(password_for_email "$email")"

  if aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$email" \
    --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
    echo "EXISTS $email"
  else
    aws cognito-idp admin-create-user --user-pool-id "$POOL" --username "$email" \
      --user-attributes \
        Name=email,Value="$email" \
        Name=email_verified,Value=true \
        Name=given_name,Value="$first" \
        Name=family_name,Value="$last" \
        Name=custom:organizationId,Value="$ORG" \
      --message-action SUPPRESS \
      --profile "$PROFILE" --region "$REGION" >/dev/null
    echo "CREATED $email"
  fi

  aws cognito-idp admin-set-user-password --user-pool-id "$POOL" --username "$email" \
    --password "$pass" --permanent --profile "$PROFILE" --region "$REGION"

  aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL" --username "$email" \
    --group-name "$group" --profile "$PROFILE" --region "$REGION" 2>/dev/null || true

  echo "  group=$group  password=$pass"
}

add_super() {
  local email="$1"
  aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL" --username "$email" \
    --group-name platform_SuperAdmin --profile "$PROFILE" --region "$REGION" 2>/dev/null || true
}

echo "=== Production pool $POOL ==="

# Super Admin + Admin
create_user "jaypritchett.owner@closetsclosets.com" "Jay" "Pritchett" "user_Admin"
add_super "jaypritchett.owner@closetsclosets.com"
create_user "i.ostolaza87@gmail.com" "Francisco" "Ostolaza" "user_Admin"
add_super "i.ostolaza87@gmail.com"

# Admin
create_user "michaelscott.boss@dundermifflin.com" "Michael" "Scott" "user_Admin"
create_user "clairedunphy.mom@icloud.com" "Claire" "Dunphy" "user_Admin"
create_user "pambeesly.art@outlook.com" "Pam" "Beesly" "user_Admin"
create_user "tobyflenderson.hr@outlook.com" "Toby" "Flenderson" "user_Admin"
create_user "neo.carbon@gmail.com" "Neo" "Carbon" "user_Admin"
create_user "nabi.apricot@gmail.com" "Nabi" "Apricot" "user_Admin"

# Manager
create_user "dwightschrute.farm@gmail.com" "Dwight" "Schrute" "user_Manager"
create_user "jimhalpert.pranks@yahoo.com" "Jim" "Halpert" "user_Manager"
create_user "oscarmartinez.account@yahoo.com" "Oscar" "Martinez" "user_Manager"
create_user "mitchellpritchett.law@outlook.com" "Mitchell" "Pritchett" "user_Manager"
create_user "angelamartin.cats@hotmail.com" "Angela" "Martin" "user_Manager"

# Facilities
create_user "kevinmalone.chili@gmail.com" "Kevin" "Malone" "user_Facilities"
create_user "creedbratton.mystery@gmail.com" "Creed" "Bratton" "user_Facilities"
create_user "stanleyhudson.crossword@hotmail.com" "Stanley" "Hudson" "user_Facilities"

# Tenant (portal)
create_user "phildunphy.realtor@gmail.com" "Phil" "Dunphy" "user_Tenant"
create_user "gloriapritchett.family@gmail.com" "Gloria" "Pritchett" "user_Tenant"
create_user "haleydunphy.influencer@yahoo.com" "Haley" "Dunphy" "user_Tenant"
create_user "lukedunphy.tricks@gmail.com" "Luke" "Dunphy" "user_Tenant"
create_user "lilypritchett.kid@gmail.com" "Lily" "Pritchett" "user_Tenant"
create_user "alexdunphy.science@gmail.com" "Alex" "Dunphy" "user_Tenant"
create_user "camerontucker.clown@gmail.com" "Cameron" "Tucker" "user_Tenant"

echo ""
echo "=== Done. Sign in at ==="
echo "Admin:  https://main.d11yajkly52yyj.amplifyapp.com/sign-in"
echo "Portal: https://main.daog7do89x2bd.amplifyapp.com/sign-in"
