# cloud-teardown
# Skill: Safe destruction of provisioned cloud resources
# Used by: CLOUD agent when npm run reset is triggered or user requests teardown
# Reference with: Use .agents/shared/cloud-teardown.md to safely remove cloud resources.

---

## Mission

Safely destroy all provisioned cloud resources in the correct order to avoid
orphaned dependencies, continued billing, or data loss.

This skill is invoked when:
- User runs `npm run reset` and cloud resources exist in CLOUD_STATE.md
- User explicitly requests teardown via the CLOUD agent
- A deployment needs to be fully rolled back

---

## Pre-flight - Read current state

Before touching anything:

```bash
cat CLOUD_STATE.md
```

Build an inventory of all provisioned resources from the Teardown Registry
and Provisioned Resources sections. If CLOUD_STATE.md shows no provisioned
resources, surface this and stop:

```
No provisioned cloud resources found in CLOUD_STATE.md.
Nothing to tear down.
```

---

## Mandatory confirmation gate

Present the full inventory of what will be destroyed:

```
I'm about to permanently destroy the following cloud resources:

  Resource          Platform ID                    Status
  ──────────────────────────────────────────────────────
  [list from CLOUD_STATE.md Teardown Registry]

⚠ This cannot be undone. Some platforms take 24-72 hours to fully
  remove resources. Billing continues until deletion is confirmed
  by the platform.

Type yes to proceed with teardown, or no to cancel.
```

If user types no - stop immediately. Write nothing to CLOUD_STATE.md.

---

## Destruction order

Always destroy in this order to avoid dependency failures:

1. **Application instances** (Vercel deployments, Railway services, Cloud Run)
2. **Database instances** (RDS, Cloud SQL, Firebase Firestore, PlanetScale)
3. **Storage buckets** (S3, GCS, Firebase Storage)
4. **Networking** (custom domains, SSL certificates, CDN)
5. **Repository/remote** (GitHub repo if applicable)
6. **IAM/credentials** (service accounts, API keys - revoke, don't delete)

---

## Per-platform teardown steps

### Vercel
```bash
vercel remove [project-name] --yes 2>/dev/null || echo "Manual: vercel.com/dashboard"
```

### Railway
```bash
railway down 2>/dev/null || echo "Manual: railway.app/dashboard"
```

### Firebase
```bash
firebase projects:delete [project-id] 2>/dev/null || echo "Manual: console.firebase.google.com"
```

### AWS
```bash
# Delete in order: ECS services → RDS → S3 → VPC → IAM roles
aws ecs delete-service --cluster [cluster] --service [service] --force 2>/dev/null
aws rds delete-db-instance --db-instance-identifier [id] --skip-final-snapshot 2>/dev/null
```

### GCP
```bash
gcloud projects delete [project-id] --quiet 2>/dev/null || echo "Manual: console.cloud.google.com"
```

### Azure
```bash
az group delete --name [resource-group] --yes 2>/dev/null || echo "Manual: portal.azure.com"
```

### Docker / Kubernetes
```bash
kubectl delete namespace [namespace] 2>/dev/null
docker compose down --volumes --rmi all 2>/dev/null
```

If CLI tools are unavailable, provide exact manual steps with URLs.

---

## After each resource is destroyed

Write to CLOUD_STATE.md Teardown Registry immediately after each deletion:

```
| [Resource] | [Platform ID] | Deletion requested | [timestamp] |
```

Do not mark as "deleted" - only "Deletion requested". Platforms take time
to fully remove resources. The user must verify final deletion on the platform.

---

## Post-teardown output

After all resources are processed:

```
Teardown complete. The following was requested for deletion:

  [list of resources with timestamps]

⚠ Note: Cloud platforms may take 24-72 hours to fully remove resources.
  Billing continues until deletion is confirmed by the platform.

  Verify deletion at:
  [platform-specific dashboard URLs]

CLOUD_STATE.md has been updated with teardown timestamps.
```

---

## Safety Rules

- Never destroy resources without the mandatory confirmation gate
- Always destroy in dependency order (app → DB → storage → network)
- Never mark resources as "deleted" - only "Deletion requested"
- Never delete IAM credentials - revoke access only
- Always provide manual fallback URLs if CLI tools fail
- Write to CLOUD_STATE.md after each resource, not at the end
