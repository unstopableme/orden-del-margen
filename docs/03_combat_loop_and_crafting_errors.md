# Specification: Combat Loop and Crafting Errors Sheet
**System Module:** Core Gameplay / UI Error Manifest  
**Status:** Gameplay Proposal (Implementation and System Validation Deferred)  
**Tracking Scope:** Offline Reference Only (No Live Validation or Exception Handling)

## 1. Functional Overview
This specification sheet outlines the text layouts, visual formatting blocks, and localization tokens for error-state overlays when an action or crafting modification fail sequence occurs. This operates purely as an offline text design template inside VS Code.

## 2. Narrative Content & Text Layout Blueprint
The interface renders systemic action failures using standard terminal-width delimiters.

```text
+----------------------------------------------------------------------------+

| [INTERFACE CRITICAL NOTICE: ACTION EXCEPTION]              [CODE: ERR_03]  |
+----------------------------------------------------------------------------+
| TRANSACTION REFERENCE: tx_forge_attunement_fail_99
| TARGET BALANCE GAIN:   0 $DONCELLA
| 
| EXCEPTION LOG OVERLAY:
|  • Error ID:          err_crafting_failure_03
|  • Primary Cause:     Materials manifest mismatch / Insufficient parameters
|  • Narrative Context:
|    "The furnace structure backfired during the refinement attempt. The raw 
|    components destabilized, and your attunement attempt has failed."
|  • Recovery Penalty:  0 $DONCELLA (No balance updates are authorized)
|  • Action State:      [ ROLLBACK STATE DISPLAY ONLY ]
|
| --------------------------------------------------------------------------
| CHRONO BOUNDARY COMPLIANCE:
|  • This error layout respects the strict continuous weekly cycle 
|    (Sunday 00:00:00 UTC Inclusive to Sunday 00:00:00 UTC Exclusive). 
|    No mid-cycle boundary mutations are processed by this interface.
+----------------------------------------------------------------------------+

| [ACKNOWLEDGE ERROR NOTICE]                                  [RETURN TO HUD] |
+----------------------------------------------------------------------------+
```

## 3. Interface String Localization Tokens
The client formatting loop references these static keys:
*   `TXT_ERROR_HEADER`: "INTERFACE CRITICAL NOTICE: ACTION EXCEPTION"
*   `TXT_LBL_ERROR_CAUSE`: "Primary Cause"
*   `TXT_VAL_DEFAULT_CURRENCY`: "\$DONCELLA"
*   `TXT_ERR_FATAL_RECOVERY`: "Fatal layout anomaly: Restoration parameters out of alignment."

| Combat loop and crafting errors sheet | `docs/03_combat_loop_and_crafting_errors.md` | REVIEWED | Pure interface blueprint layout and fallback text description; no code or database calculations |
