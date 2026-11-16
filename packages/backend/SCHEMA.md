# Schema

Generated from `packages/backend/convex/schema.ts` by `tools/schema-diagram.ts`. Update it with `pnpm --filter @meetings/backend test -u`.

```mermaid
erDiagram
  users {
    id _id PK
    string name "optional"
    string email "optional"
    string bio "optional"
    id imageId FK "_storage, optional"
    enum method
    boolean isVerified
    string seenTimeZone "optional"
  }
  organizations {
    id _id PK
    string name
  }
  members {
    id _id PK
    id orgId FK "organizations"
    id userId FK "users"
  }
  roles {
    id _id PK
    id orgId FK "organizations"
    string name
    object permissions
  }
  memberRoles {
    id _id PK
    id orgId FK "organizations"
    id memberId FK "members"
    id roleId FK "roles"
  }
  tokens {
    id _id PK
    string value
    number expiresAt
  }
  invites {
    id _id PK
    id orgId FK "organizations"
    id roleId FK "roles"
    id invitedBy FK "users"
    id tokenId FK "tokens"
    string email
    string emailError "optional"
  }
  groups {
    id _id PK
    id orgId FK "organizations"
    string name
  }
  groupMembers {
    id _id PK
    id orgId FK "organizations"
    id groupId FK "groups"
    id userId FK "users"
  }
  meetings {
    id _id PK
    id orgId FK "organizations"
    id userId FK "users"
    string code
    string title
    enum kind
    boolean recap
    string rtkMeetingId "optional"
  }
  meetingTimes {
    id _id PK
    id meetingId FK "meetings"
    number date
    string start
    string end
    string timeZone
    number startsAt
    number endsAt
    string rrule "optional"
  }
  meetingMembers {
    id _id PK
    id meetingId FK "meetings"
    id userId FK "users"
    enum response
    enum role
    string rtkParticipantId "optional"
  }
  meetingSessions {
    id _id PK
    id meetingId FK "meetings"
    string rtkSessionId
    number startedAt
    number endedAt "optional"
    array attendeeIds
    string summary "optional"
    string transcriptUrl "optional"
    string recordingUrl "optional"
  }
  messages {
    id _id PK
    id meetingId FK "meetings"
    id meetingMemberId FK "meetingMembers"
    string body
  }
  schedules {
    id _id PK
    id userId FK "users"
    string timeZone
    array weeklyHours
    array alsoShow
  }
  users }o--o| _storage : imageId
  members }o--|| organizations : orgId
  members }o--|| users : userId
  roles }o--|| organizations : orgId
  memberRoles }o--|| organizations : orgId
  memberRoles }o--|| members : memberId
  memberRoles }o--|| roles : roleId
  invites }o--|| organizations : orgId
  invites }o--|| roles : roleId
  invites }o--|| users : invitedBy
  invites }o--|| tokens : tokenId
  groups }o--|| organizations : orgId
  groupMembers }o--|| organizations : orgId
  groupMembers }o--|| groups : groupId
  groupMembers }o--|| users : userId
  meetings }o--|| organizations : orgId
  meetings }o--|| users : userId
  meetingTimes }o--|| meetings : meetingId
  meetingMembers }o--|| meetings : meetingId
  meetingMembers }o--|| users : userId
  meetingSessions }o--|| meetings : meetingId
  messages }o--|| meetings : meetingId
  messages }o--|| meetingMembers : meetingMemberId
  schedules }o--|| users : userId
```

## Indexes

| Table | Index | Fields |
| --- | --- | --- |
| members | by_org_and_user | orgId, userId |
| members | by_user | userId |
| roles | by_org_and_name | orgId, name |
| memberRoles | by_member_and_role | memberId, roleId |
| memberRoles | by_role | roleId |
| tokens | by_value | value |
| tokens | by_expiresAt | expiresAt |
| invites | by_org | orgId |
| invites | by_token | tokenId |
| invites | by_org_and_email | orgId, email |
| groups | by_org | orgId |
| groupMembers | by_group_and_user | groupId, userId |
| groupMembers | by_org_and_user | orgId, userId |
| meetings | by_org_and_user_and_title | orgId, userId, title |
| meetings | by_rtk_meeting | rtkMeetingId |
| meetings | by_code | code |
| meetingTimes | by_meeting | meetingId |
| meetingTimes | by_date | date |
| meetingMembers | by_meeting_and_user | meetingId, userId |
| meetingMembers | by_user | userId |
| meetingSessions | by_meeting | meetingId |
| meetingSessions | by_rtk_session | rtkSessionId |
| messages | by_meeting | meetingId |
| schedules | by_user | userId |
