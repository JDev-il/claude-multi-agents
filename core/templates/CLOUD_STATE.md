# CLOUD_STATE.md
# Deployment state. Read by ALL agents at session start. Updated incrementally by all agents.
# Written by CLOUD agent during deployment. Never edit manually.

## Target
Platform   : none
Profile    : none
Type       : none
Decided on : not set

## Provisioned Resources
# Written by CLOUD agent - these exist on the platform
- [ ] App registered     : none
- [ ] Database created   : none
- [ ] Storage created    : none
- [ ] Domain configured  : none

## Environments

### Local
env file      : missing
last verified : never

### Staging
platform      : none
url           : none
env vars      : none
last deployed : never

### Production
platform      : none
url           : none
env vars      : none
last deployed : never

## Wiring
Client -> Backend : not configured
CORS              : not configured
API base URL      : not set

## Secrets Registry
# Keys only - never values. Add entries as they are configured.
# Format: KEY_NAME : environment (local / staging / production / all)

## Teardown Registry
# Populated when npm run reset or cloud-teardown is triggered.
# Format: | Resource | Platform ID | Status | Requested on |
| Resource | Platform ID | Status | Requested on |
|----------|-------------|--------|--------------|

## Deployment Log
# Written by CLOUD agent after each deployment action.
# Format: | Date | Agent | Environment | Action | Status | Notes |
| Date | Agent | Environment | Action | Status | Notes |
|------|-------|-------------|--------|--------|-------|
