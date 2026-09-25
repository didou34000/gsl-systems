-- Read membership changes made by the BEFORE INSERT trigger within this statement.
alter function private.is_member(uuid,text[]) volatile;
