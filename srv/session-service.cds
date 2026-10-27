@path    : '/odata/v4/session'
@requires: 'authenticated-user'
service SessionService {
    type Me {
        id             : String;
        roles          : array of String;
        isYardWorker   : Boolean;
        isDispatcher   : Boolean;
        isTechnician   : Boolean;
        isBillingClerk : Boolean;
        isManager      : Boolean;
        isAdmin        : Boolean;
        isAuditor      : Boolean;
    }

    function me() returns Me;
}
