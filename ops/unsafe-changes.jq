# The change sets stack.sh refuses: each change that removes or replaces a resource, one line each,
# naming it. Input: aws cloudformation describe-change-set's output. $take: the logical ids the
# plan's step names on purpose. An empty output is a change set that only adds and modifies in
# place. "Dynamic" and "Conditional" count too: they may replace. A replaced box is kept, not deleted
# (Box retains on a replacement). The new box comes up with an empty database and the old one holds
# the only copy of the records, outside the stack. The app keeps reaching the old box until the next
# deploy swings it to the new one (ops/env.yml, the deploy sets the BFF's variables from the box's
# files), so the hazard is a push that deploys before a reseed. ops/README.md, "Reading what the
# fence kept".
.Changes[]?.ResourceChange
| select(.Action == "Remove" or .Action == "Dynamic" or .Replacement == "True" or .Replacement == "Conditional")
| select(.LogicalResourceId as $id | any($take[]; . == $id) | not)
| "\(.LogicalResourceId) (\(.ResourceType)): \(.Action), replacement \(.Replacement // "none")"
