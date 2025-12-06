Perform a comprehensive documentation audit and generate a report:

## Tasks:

1. **Scan all .md files** in `/docs` directory (excluding node_modules)
   - List each file with: name, size (lines), last modified date
   - Calculate total lines of documentation

2. **Identify stale documents**
   - Flag files not modified in 60+ days
   - Flag files not referenced in CLAUDE.md or INDEX.md
   - Flag files with "TODO" or "DRAFT" in content

3. **Check for duplicates**
   - Find overlapping content between files
   - Identify similar headings/topics across files
   - Suggest files that could be merged

4. **Verify INDEX.md accuracy**
   - Check all files listed in INDEX.md still exist
   - Check all files in /docs are listed in INDEX.md
   - Verify line counts and last updated dates match reality

5. **Generate cleanup suggestions**
   - Which files should be archived
   - Which files should be merged
   - Which files need status updates
   - Which files are missing headers (Last Updated, Status, Purpose)

6. **Report format:**
   ```
   📊 DOCUMENTATION AUDIT REPORT
   Generated: [date]

   📈 Statistics:
   - Total files: X
   - Active: X
   - Archived: X
   - Total lines: X

   ⚠️ Issues Found:
   - X stale files (60+ days)
   - X unreferenced files
   - X duplicates detected
   - X missing from INDEX.md

   🎯 Recommendations:
   1. Archive: [list files]
   2. Merge: [list files to merge]
   3. Update: [list files needing headers]
   4. Remove: [list obsolete files]

   ✅ Healthy Files:
   [list of well-maintained docs]
   ```

**IMPORTANT:**
- Do NOT modify any files - only report findings
- Do NOT archive or delete anything - only suggest
- Do NOT create new documentation - only audit existing
- Present findings in a clear, actionable format
