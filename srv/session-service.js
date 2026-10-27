const cds = require('@sap/cds');
const { ROLES } = require('./lib/common');

module.exports = class SessionService extends cds.ApplicationService {
    init() {
        this.on('me', req => {
            const roles = ROLES.filter(r => req.user.is(r));
            return {
                id: req.user.id, roles,
                ...Object.fromEntries(ROLES.map(r => ['is' + r, roles.includes(r)]))
            };
        });
        return super.init();
    }
};
