const { MongoClient, ObjectId } = require('mongodb');
const bluebird = require('bluebird');

const accountId = ObjectId('524ac7b6019a607957000033');
const graphName = 'gremlin';

const gremlin = require('gremlin');
const __ = gremlin.process.statics;
const { P } = gremlin.process;

const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;

const dc = new DriverRemoteConnection(`ws://localhost:8182/${graphName}`);
const graph = new Graph();
const g = graph.traversal().withRemote(dc);

let locationModel;

const connect = async () => {
	try {
		// connect to mongo
		const client = await MongoClient.connect(process.env.MONGO_URL);
		const locationConnection = client.db('location-live');
		locationModel = await locationConnection.collection('location');
		contentModel = await locationConnection.collection('content');
	} catch ({ message }) {
		throw new Error(message);
	}
}

const buildLocations = async () => {
	const allLocations = await locationModel.find({ accountId }).toArray();
	await bluebird.each(
		allLocations,
		async location => {
			try {
				await g.addV('location').property(__.id, location._id.toString()).property('name', location.name).next()
			} catch ({ message }) {
				throw new Error(message);
			}
		},
	);

	await bluebird.each(
		allLocations,
		async location => {
			if(location.parentLocationId) {
				await g.addE('inside').from_(location._id.toString()).to(location.parentLocationId.toString()).iterate();
			}
		}
	)

}

const buildContent = async () => {
	const recentContent = await contentModel.find({ accountId, archivedAt: null }).limit(100).sort({ _id: -1 });

	await bluebird.each(
		recentContent,
		async content => {
			await g.addV('content').property(__.id, content._id.toString()).property('name', content.name).next();
			if(content.parentLocationId) {
				await g.addE('inside').from_(content._id.toString()).to(content.parentLocationId.toString()).iterate();
			}
		}
	)
}

const writeToFile = async () => {
	// do tree lookup

	// map into correct structure
	// http://visjs.org/docs/network/

	// write to file

}

const run = async () => {
	await connect();
	await buildLocations();
	await buildContent();
	await writeToFile();

	process.exit();
}

run();
