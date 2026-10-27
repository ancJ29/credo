# The change sets stack.sh refuses: each change that removes or replaces a resource, one line each,
# naming it. Input: aws cloudformation describe-change-set's output. $take: the logical ids the
# plan's step names on purpose. An empty output is a change set that only adds and modifies in
# place. "Dynamic" and "Conditional" count too: they may replace, and a replaced box deletes its
# disk and the database with it.
.Changes[]?.ResourceChange
| select(.Action == "Remove" or .Action == "Dynamic" or .Replacement == "True" or .Replacement == "Conditional")
| select(.LogicalResourceId as $id | any($take[]; . == $id) | not)
| "\(.LogicalResourceId) (\(.ResourceType)): \(.Action), replacement \(.Replacement // "none")"
