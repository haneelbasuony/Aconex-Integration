'use strict';

const axios = require('axios');
const { CONFIG, RESOURCE_SERVER } = require('../config');


async function getWorkflows(accessToken, {
    pageNumber = 1,
    pageSize = 100
} = {}) {

    const response = await axios.get(
        `${RESOURCE_SERVER}/api/projects/${CONFIG.projectId}/workflows`,
        {
            headers:{
                Authorization:`Bearer ${accessToken}`,
                Accept:'application/vnd.aconex.workflow.v1+xml'
            },
            params:{
                page_number: pageNumber,
                page_size: pageSize
            }
        }
    );


    return response.data;
}


module.exports = {
    getWorkflows
};