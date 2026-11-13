# The resource changes a front-door key run may not make: one line each ("<id> (<type>): <action>").
# A key run changes the distribution and nothing else, and only by the new value of the FrontDoorKey
# parameter. For that one change CloudFormation documents two details per target (the user guide's
# "Modifying an input parameter value"): a Static one whose ChangeSource is ParameterReference and whose
# CausingEntity is the parameter, and a Dynamic one with ChangeSource DirectModification and no
# CausingEntity, over the same Target. Any other detail (a template edit is a Static DirectModification,
# another parameter has another CausingEntity) or a Dynamic one with no Static partner is refused.
def fromKey: .Evaluation == "Static" and .ChangeSource == "ParameterReference" and .CausingEntity == "FrontDoorKey";
def partnered($all): . as $d | .Evaluation == "Dynamic" and .ChangeSource == "DirectModification" and .CausingEntity == null
  and any($all[]; fromKey and .Target == $d.Target);
def keyOnly: (.Details // []) as $ds | ($ds | any(fromKey)) and all($ds[]; fromKey or partnered($ds));
.Changes[]?.ResourceChange
| select(.Action != "Modify" or .LogicalResourceId != "Distribution" or (keyOnly | not))
| "\(.LogicalResourceId) (\(.ResourceType)): \(.Action)"
